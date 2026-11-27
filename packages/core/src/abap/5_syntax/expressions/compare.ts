import * as Expressions from "../../2_statements/expressions";
import {ExpressionNode, TokenNode} from "../../nodes";
import {Source} from "./source";
import {MethodCallChain} from "./method_call_chain";
import {SourceFieldSymbol} from "./source_field_symbol";
import {SyntaxInput, syntaxIssue} from "../_syntax_input";
import {AbstractType} from "../../types/basic/_abstract_type";
import {CGenericType, CharacterType, CLikeType, CSequenceType, DateType, HexType, NGenericType, NumericType,
  StringType, StructureType, TimeType, UTCLongType, XGenericType, XSequenceType, XStringType} from "../../types/basic";
import {TypeUtils} from "../_type_utils";
import {BuiltIn} from "../_builtin";
import {BuiltInCall} from "../_builtin_call";
import {checkOperandParentheses, withoutParentheses} from "../_parentheses";

const COMPARISON_OPERATORS = ["=", "EQ", "<>", "NE", "><", "<", "LT", ">", "GT", "<=", "LE", "=<", ">=", "GE", "=>"];
// the comparison operators for character-like operands
const CHARACTER_OPERATORS = ["CO", "CN", "CA", "NA", "CS", "NS", "CP", "NP"];
// the comparison operators for byte-like operands, and those for bit patterns
const BYTE_OPERATORS = ["BYTE-CO", "BYTE-CN", "BYTE-CA", "BYTE-NA", "BYTE-CS", "BYTE-NS", "O", "Z", "M"];
// built-in numeric functions of one argument, and those with further parameters
const ONE_ARGUMENT_FUNCTIONS = ["abs", "sign", "ceil", "floor", "trunc", "frac", "acos", "asin", "atan", "cos",
  "sin", "tan", "cosh", "sinh", "tanh", "exp", "log", "log10", "sqrt"];
const SEVERAL_PARAMETER_FUNCTIONS = ["ipow", "nmax", "nmin", "round", "rescale"];
const LENGTH_FUNCTIONS = ["strlen", "xstrlen", "numofchar"];

export class Compare {
  public static runSyntax(node: ExpressionNode, input: SyntaxInput): void {

    const sources = node.findDirectExpressions(Expressions.Source);

    // reported before the operands are checked, which then skip the more general predicate function message
    const initialMessage = this.checkInitialOperand(node, input);
    const predicateMessage = this.checkPredicateOperand(sources, input);
    const operandMessage = initialMessage ?? predicateMessage;
    if (operandMessage !== undefined) {
      input.issues.push(syntaxIssue(input, node.getFirstToken(), operandMessage));
    }

    // the operands are always checked, for their own errors and references
    const sourceTypes: (AbstractType | undefined)[] = [];
    for (const t of sources) {
      sourceTypes.push(Source.runSyntax(t, input));
    }

    for (const t of node.findDirectExpressions(Expressions.SourceFieldSymbolChain)) {
      SourceFieldSymbol.runSyntax(t, input);
    }

    for (const t of node.findDirectExpressions(Expressions.MethodCallChain)) {
      MethodCallChain.runSyntax(t, input);
    }

    if (operandMessage !== undefined) {
      return;
    }

    checkOperandParentheses(sources, input);

    const arithmeticMessage = this.checkArithmeticOperands(node, sources, sourceTypes, input);
    if (arithmeticMessage !== undefined) {
      input.issues.push(syntaxIssue(input, node.getFirstToken(), arithmeticMessage));
      return;
    }

    const typeUtils = new TypeUtils(input.scope);
    const compareOperator = node.findDirectExpression(Expressions.CompareOperator)?.concatTokens().toUpperCase();

    if (this.lacksComparisonType(node, sourceTypes, typeUtils)) {
      input.issues.push(syntaxIssue(input, node.getFirstToken(), "Incompatible types for comparison"));
    } else if (this.lacksCharacterOperands(node, sources, sourceTypes, typeUtils, input)) {
      const message = `${compareOperator} operands must be character-like (data type C, N, D, T, or STRING)`;
      input.issues.push(syntaxIssue(input, node.getFirstToken(), message));
    } else if (compareOperator !== undefined && BYTE_OPERATORS.includes(compareOperator)) {
      if (this.lacksByteOperands(sources, sourceTypes, typeUtils, input)) {
        const message = `${compareOperator} operands must be byte-like (data type X or XSTRING)`;
        input.issues.push(syntaxIssue(input, node.getFirstToken(), message));
      }
    } else if (node.findDirectExpression(Expressions.CompareOperator)
        && typeUtils.isCompareable(sourceTypes[0], sourceTypes[1], sources[0], sources[1]) === false
        && sourceTypes.length === 2) {
      input.issues.push(syntaxIssue(input, node.getFirstToken(), "Incompatible types for comparison"));
    }
  }

  // a built-in function with a character-like result cannot be the operand of IS [NOT] INITIAL,
  // "Unexpected operator IS" on a system, while one with a numeric result, lines( ), can
  private static checkInitialOperand(node: ExpressionNode, input: SyntaxInput): string | undefined {
    if (input.scope.getOpenABAP()) {
      return undefined;
    }
    const tokens = node.getChildren().filter(c => c instanceof TokenNode).map(c => c.getFirstToken().getStr().toUpperCase());
    if (tokens.includes("IS") === false || tokens[tokens.length - 1] !== "INITIAL") {
      return undefined;
    }
    const chain = node.findDirectExpression(Expressions.Source)?.getChildren();
    // xsdbool( ) and boolc( ) are their own form in the Source grammar, a condition in parentheses
    const first = chain?.[0]?.getFirstToken().getStr().toUpperCase();
    if (chain?.length === 4 && chain[0] instanceof TokenNode && (first === "XSDBOOL" || first === "BOOLC")) {
      return `Built-in function "${chain[0].getFirstToken().getStr()}" cannot be the operand of IS INITIAL`;
    }
    const name = this.builtinCallName(node.findDirectExpression(Expressions.Source), input);
    const returning = BuiltIn.searchBuiltin(name)?.getParameters().getReturning()?.getType();
    if (returning instanceof StringType || returning instanceof CharacterType) {
      return `Built-in function "${name}" cannot be the operand of IS INITIAL`;
    }
    return undefined;
  }

  // a predicate function, contains( ) or line_exists( ), is a relational expression and not a value,
  // it can stand alone as a condition or inside boolc( ) or xsdbool( ), but cannot be an operand of a comparison
  private static checkPredicateOperand(sources: readonly ExpressionNode[], input: SyntaxInput): string | undefined {
    if (input.scope.getOpenABAP()) {
      return undefined;
    }
    let message: string | undefined = undefined;
    for (const source of sources) {
      const name = this.builtinCallName(source, input);
      if (BuiltIn.isPredicate(name) === true) {
        Source.predicateReported(source);
        message = message ?? `Predicate function "${name}" cannot be the operand of a comparison`;
      }
    }
    return message;
  }

  // the name of the built-in function when the source is exactly one call of it, not hidden by a method of the same name
  private static builtinCallName(source: ExpressionNode | undefined, input: SyntaxInput): string | undefined {
    const call = BuiltInCall.fromSource(source, input);
    return call === undefined ? undefined : BuiltInCall.callName(call);
  }

  // both operands of CO, CS, CP and the other operators for character-like data are character-like, with one
  // exception on the right, see isNumericFunctionOfDataObject, which does not apply after a character-like
  // expression on the left
  private static lacksCharacterOperands(node: ExpressionNode, sources: readonly ExpressionNode[],
                                        types: readonly (AbstractType | undefined)[], typeUtils: TypeUtils,
                                        input: SyntaxInput): boolean {
    const operator = node.findDirectExpression(Expressions.CompareOperator)?.concatTokens().toUpperCase();
    if (operator === undefined || CHARACTER_OPERATORS.includes(operator) === false || sources.length !== 2) {
      return false;
    }
    const charLike = sources.map((s, i) => this.isTableBody(s) === false && typeUtils.isCharLikeForCompare(types[i]));
    return charLike[0] === false
      || (charLike[1] === false
        && (this.isCharacterExpression(sources[0], input) || this.isNumericFunctionOfDataObject(sources[1], input) === false));
  }

  // both operands of BYTE-CO, O and the other operators for byte-like data are byte-like, with the same exception on
  // the right as for character-like data, which does not apply after a bit expression on the left
  private static lacksByteOperands(sources: readonly ExpressionNode[], types: readonly (AbstractType | undefined)[],
                                   typeUtils: TypeUtils, input: SyntaxInput): boolean {
    if (sources.length !== 2) {
      return false;
    }
    const byteLike = sources.map((s, i) => this.isTableBody(s) === false && typeUtils.isByteLikeForCompare(types[i]));
    return byteLike[0] === false
      || (byteLike[1] === false
        && (this.isBitExpression(sources[0]) || this.isNumericFunctionOfDataObject(sources[1], input) === false));
  }

  // "tab[]" is the table itself, while its type is that of "tab", which can be a header line
  private static isTableBody(source: ExpressionNode): boolean {
    return source.findDirectExpression(Expressions.FieldChain)?.findDirectExpression(Expressions.TableBody) !== undefined;
  }

  // "a BIT-AND b", "BIT-NOT a", "bit-set( n )" or "boolx( bool = a = b bit = n )"
  private static isBitExpression(source: ExpressionNode): boolean {
    const operand = withoutParentheses(source);
    const first = operand.getFirstChild();
    if (first instanceof TokenNode && ["BIT", "BOOLX"].includes(first.getFirstToken().getStr().toUpperCase())) {
      return true;
    }
    return operand.findDirectExpressions(Expressions.ArithOperator)
      .some(o => o.concatTokens().toUpperCase().startsWith("BIT-"));
  }

  // "a && b", a string template, or a built-in function with a character-like result, "to_upper( a )" or
  // "boolc( a = b )". Literals joined with "&" are a single literal
  private static isCharacterExpression(source: ExpressionNode, input: SyntaxInput): boolean {
    const operand = withoutParentheses(source);
    const first = operand.getFirstChild();
    if (operand.findDirectTokenByText("&&") !== undefined || first?.get() instanceof Expressions.StringTemplate) {
      return true;
    } else if (first instanceof TokenNode && ["BOOLC", "XSDBOOL"].includes(first.getFirstToken().getStr().toUpperCase())) {
      return true;
    }
    const name = this.builtinCallName(operand, input)?.toUpperCase();
    const returning = BuiltIn.searchBuiltin(name)?.getParameters().getReturning()?.getType();
    return returning instanceof StringType || returning instanceof CharacterType;
  }

  // a numeric built-in function of a data object, "strlen( s )" or "lines( tab )". As the right operand of CO, CS
  // and the other operators for character-like operands it is expected to be accepted, odd as that is
  private static isNumericFunctionOfDataObject(source: ExpressionNode, input: SyntaxInput): boolean {
    const call = BuiltInCall.fromSource(withoutParentheses(source), input);
    if (call === undefined
        || BuiltInCall.isNumeric(call) === false
        || BuiltIn.hasUnnamedArgument(BuiltInCall.callName(call)) === false) {
      return false;
    }
    const argument = call.findDirectExpression(Expressions.MethodCallParam)?.findDirectExpression(Expressions.Source);
    return argument !== undefined && BuiltInCall.isDataObject(withoutParentheses(argument));
  }

  // two operands without a comparison type, eg. a date and a time, also as operand and bound of BETWEEN. The
  // operators for character-like and byte-like operands, like CS or O, have their own rules
  private static lacksComparisonType(node: ExpressionNode, types: readonly (AbstractType | undefined)[],
                                     typeUtils: TypeUtils): boolean {
    const operator = node.findDirectExpression(Expressions.CompareOperator)?.concatTokens().toUpperCase();
    let pairs: [number, number][] = [];
    if (operator !== undefined && COMPARISON_OPERATORS.includes(operator) && types.length === 2) {
      pairs = [[0, 1]];
    } else if (node.findDirectTokenByText("BETWEEN") !== undefined && types.length === 3) {
      pairs = [[0, 1], [0, 2]];
    }
    return pairs.some(([a, b]) => typeUtils.hasComparisonType(types[a], types[b]) === false);
  }

  // an arithmetic expression can only be compared with a numeric operand or another arithmetic expression,
  // a character-like, byte-like, date, time or structured operand is expected to be a syntax error,
  // the operand can be made an arithmetic expression with a "+" in front, "+ lv_c". The three operands of
  // BETWEEN share one calculation, so an arithmetic expression among them applies to the two others
  private static checkArithmeticOperands(node: ExpressionNode, sources: readonly ExpressionNode[],
                                         types: readonly (AbstractType | undefined)[],
                                         input: SyntaxInput): string | undefined {
    const comparison = node.findDirectExpression(Expressions.CompareOperator) !== undefined && sources.length === 2;
    const between = node.findDirectTokenByText("BETWEEN") !== undefined && sources.length === 3;
    if (comparison === false && between === false) {
      return undefined;
    }

    const arithmetic = sources.map(s => this.isArithmetic(s, input));
    if (arithmetic.includes(true) === false) {
      return undefined;
    }

    for (let i = 0; i < sources.length; i++) {
      if (arithmetic[i] === true) {
        continue;
      } else if (types[i] instanceof UTCLongType) {
        return `A time stamp of type utclong cannot be compared with an arithmetic expression`;
      } else if (this.isNonNumeric(types[i]) === true) {
        const operand = sources[i].concatTokens();
        return `Arithmetic expression cannot be compared with non-numeric operand "${operand}", use "+ ${operand}"`;
      }
    }
    return undefined;
  }

  // "a + b", "- a", "( a * b )", "ipow( base = a exp = b )" or "abs( a + b )",
  // but not "( a )", "abs( a )", "a && b" or "a BIT-AND b"
  public static isArithmetic(source: ExpressionNode, input: SyntaxInput): boolean {
    const children = source.getChildren();
    const first = children[0];
    if (first instanceof TokenNode) {
      const str = first.getFirstToken().getStr();
      if (str === "+" || str === "-") {
        return true;
      } else if (str === "(" && children.length === 3 && children[1] instanceof ExpressionNode) {
        return this.isArithmetic(children[1], input);
      }
    }
    for (const child of children) {
      if (child instanceof ExpressionNode
          && child.get() instanceof Expressions.ArithOperator
          && child.concatTokens().toUpperCase().startsWith("BIT-") === false) {
        return true;
      }
    }
    return this.isArithmeticFunction(source, input);
  }

  // a built-in numeric function is part of a calculation when it has several parameters, or when its argument
  // is calculated itself, "abs( a + b )" or "abs( strlen( s ) )". Of a data object it is a value of its own
  private static isArithmeticFunction(source: ExpressionNode, input: SyntaxInput): boolean {
    const call = BuiltInCall.fromSource(source, input);
    const name = call === undefined ? undefined : BuiltInCall.callName(call)?.toLowerCase();
    if (call === undefined || name === undefined) {
      return false;
    } else if (SEVERAL_PARAMETER_FUNCTIONS.includes(name)) {
      return true;
    } else if (ONE_ARGUMENT_FUNCTIONS.includes(name) === false) {
      return false;
    }

    const argument = call.findDirectExpression(Expressions.MethodCallParam)?.findDirectExpression(Expressions.Source);
    if (argument === undefined) {
      return false;
    }
    const inner = this.builtinCallName(argument, input)?.toLowerCase();
    return this.isArithmetic(argument, input)
      || (inner !== undefined && (ONE_ARGUMENT_FUNCTIONS.includes(inner) || LENGTH_FUNCTIONS.includes(inner)));
  }

  private static isNonNumeric(type: AbstractType | undefined): boolean {
    return type instanceof CharacterType
      || type instanceof StringType
      || type instanceof NumericType
      || type instanceof DateType
      || type instanceof TimeType
      || type instanceof HexType
      || type instanceof XStringType
      || type instanceof StructureType
      || type instanceof CLikeType
      || type instanceof CSequenceType
      || type instanceof CGenericType
      || type instanceof NGenericType
      || type instanceof XSequenceType
      || type instanceof XGenericType;
  }

}
