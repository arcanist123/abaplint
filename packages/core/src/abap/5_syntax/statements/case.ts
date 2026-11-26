import * as Expressions from "../../2_statements/expressions";
import {ExpressionNode, StatementNode, TokenNode} from "../../nodes";
import {BuiltInCall} from "../_builtin_call";
import {checkOperandParentheses, parenthesized} from "../_parentheses";
import {Source} from "../expressions/source";
import {Compare} from "../expressions/compare";
import {StatementSyntax} from "../_statement_syntax";
import {SyntaxInput, syntaxIssue} from "../_syntax_input";
import {BuiltIn} from "../_builtin";
import {ObjectOriented} from "../_object_oriented";
import {ObjectReferenceType} from "../../types/basic";
import {LanguageVersion, Release, releaseAtLeast} from "../../../version";

export class Case implements StatementSyntax {
  public runSyntax(node: StatementNode, input: SyntaxInput): void {
    for (const s of node.findDirectExpressions(Expressions.Source)) {
      const type = Source.runSyntax(s, input);
      const inner = parenthesized(s);
      if (inner !== undefined && isCalculation(inner, input) === false) {
        const message = "Parentheses after CASE only around a calculation, not around a single operand";
        input.issues.push(syntaxIssue(input, s.getFirstToken(), message));
      } else {
        checkOperandParentheses([s], input);
      }
      checkCaseOperand(s, input);
      // an arithmetic expression is calculated on its own, the values after WHEN are compared with its result
      if (input.caseOperand && Compare.isArithmetic(s, input) === false) {
        input.caseOperand.type = type;
      }
    }
  }
}

// "a + 1", "- a", "BIT-NOT x", "x BIT-AND y", or a built-in numeric function of a calculated argument,
// "abs( a + 1 )", "strlen( lcl=>get( ) )", "ipow( base = abs( a ) exp = 2 )". Not a single operand: a data object,
// a method call, a constructor or table expression, a built-in function of data objects only, or a string
// expression, "( a )", "( lcl=>get( a + 1 ) )", "( CONV i( a + 1 ) )", "( strlen( s ) )" or "( c && s )"
function isCalculation(source: ExpressionNode, input: SyntaxInput): boolean {
  const inner = parenthesized(source);
  if (inner !== undefined) {
    return isCalculation(inner, input);
  }

  const children = source.getChildren();
  const first = children[0];
  if (first instanceof TokenNode && ["+", "-"].includes(first.getFirstToken().getStr())) {
    return true;
  } else if (first instanceof TokenNode && /^BIT-NOT /i.test(source.concatTokens())) {
    // the lexer splits BIT-NOT into three tokens
    return true;
  } else if (children.some(c => c.get() instanceof Expressions.ArithOperator)) {
    return true;
  }

  const call = BuiltInCall.fromSource(source, input);
  return call !== undefined
    && BuiltInCall.isNumeric(call)
    && BuiltInCall.callArguments(call).some(a => isCalculatedArgument(a, input));
}

// an argument that makes a built-in function a calculation: anything but a data object or a string expression
function isCalculatedArgument(argument: ExpressionNode, input: SyntaxInput): boolean {
  const inner = parenthesized(argument);
  if (inner !== undefined) {
    return isCalculation(inner, input);
  } else if (BuiltInCall.isDataObject(argument)) {
    return false;
  }

  const children = argument.getChildren();
  if (children.some(c => c instanceof TokenNode && ["&", "&&"].includes(c.getFirstToken().getStr()))
      || children[0]?.get() instanceof Expressions.StringTemplate
      || ["BOOLC", "XSDBOOL"].includes(children[0]?.getFirstToken().getStr().toUpperCase())) {
    return false;
  }
  const call = BuiltInCall.fromSource(argument, input);
  return call === undefined || BuiltInCall.isNumeric(call);
}

// Before 7.40 SP02 the operands of CASE and WHEN are enhanced functional operand positions: besides
// data objects and functional methods, only built-in functions with exactly one unnamed argument are allowed
export function checkCaseOperand(source: ExpressionNode, input: SyntaxInput): void {
  if (releaseAtLeast(input.scope.getRelease(), Release.v740sp02)
      || input.scope.getLanguageVersion() === LanguageVersion.Cloud
      || input.scope.getOpenABAP()) {
    return;
  }

  const chain = source.findDirectExpression(Expressions.MethodCallChain);
  if (chain === undefined || source.getChildren().length !== 1 || chain.getChildren().length !== 1) {
    return;
  }
  const call = chain.findDirectExpression(Expressions.MethodCall);
  const nameToken = call?.findDirectExpression(Expressions.MethodName)?.getFirstToken();
  const name = nameToken?.getStr();
  if (nameToken === undefined || BuiltIn.searchBuiltin(name) === undefined || BuiltIn.hasUnnamedArgument(name)) {
    return;
  }

  // a method of the enclosing class takes precedence over the built-in function
  const meType = input.scope.findVariable("me")?.getType();
  if (meType instanceof ObjectReferenceType) {
    const def = input.scope.findObjectDefinition(meType.getIdentifierName());
    if (new ObjectOriented(input.scope).searchMethodName(def, name).method !== undefined) {
      return;
    }
  }

  const message = "Built-in function " + name + " not allowed as CASE/WHEN operand before v740sp02";
  input.issues.push(syntaxIssue(input, nameToken, message));
}
