import * as Expressions from "../2_statements/expressions";
import {ExpressionNode, TokenNode} from "../nodes";
import {NumericGenericType} from "../types/basic";
import {BuiltIn} from "./_builtin";
import {BuiltInCall} from "./_builtin_call";
import {SyntaxInput, syntaxIssue} from "./_syntax_input";

// the source inside the parentheses when the source is exactly "( ... )"
export function parenthesized(source: ExpressionNode): ExpressionNode | undefined {
  const children = source.getChildren();
  if (children.length === 3
      && children[0] instanceof TokenNode && children[0].getFirstToken().getStr() === "("
      && children[1] instanceof ExpressionNode && children[1].get() instanceof Expressions.Source) {
    return children[1];
  }
  return undefined;
}

function withoutParentheses(source: ExpressionNode): ExpressionNode {
  const inner = parenthesized(source);
  return inner === undefined ? source : withoutParentheses(inner);
}

// Outside of a calculation, in a comparison or after CASE, a data object as the argument of a numeric function cannot
// be in parentheses, "abs( ( a ) ) = 1", while "abs( ( a ) ) = b + 1" is a calculation. The operands share the
// calculation, so one of them being calculated is enough
export function checkOperandParentheses(operands: readonly ExpressionNode[], input: SyntaxInput) {
  if (operands.some(o => isCalculationOperand(o, input))) {
    return;
  }

  for (const operand of operands) {
    const call = BuiltInCall.fromSource(withoutParentheses(operand), input);
    const name = call === undefined ? undefined : BuiltInCall.callName(call);
    const parameter = BuiltIn.searchBuiltin(name?.toUpperCase())?.getParameters().getImporting()[0];
    if (call === undefined
        || BuiltIn.hasUnnamedArgument(name) === false
        || !(parameter?.getType() instanceof NumericGenericType)) {
      continue;
    }

    const argument = call.findDirectExpression(Expressions.MethodCallParam)?.findDirectExpression(Expressions.Source);
    const inner = argument === undefined ? undefined : parenthesized(argument);
    if (inner !== undefined && BuiltInCall.isDataObject(withoutParentheses(inner))) {
      const message = `Parentheses around the argument of "${name}" are only allowed in a calculation`;
      input.issues.push(syntaxIssue(input, argument!.getFirstToken(), message));
    }
  }
}

// an arithmetic expression, or a numeric function which is more than a function of a single data object,
// "abs( a + 1 )", "abs( lcl=>get( ) )", "strlen( s && s )" or "ipow( base = a exp = 2 )"
function isCalculationOperand(source: ExpressionNode, input: SyntaxInput): boolean {
  const operand = withoutParentheses(source);
  const children = operand.getChildren();
  const first = children[0];
  if (first instanceof TokenNode && ["+", "-"].includes(first.getFirstToken().getStr())) {
    return true;
  } else if (children.some(c => c.get() instanceof Expressions.ArithOperator
      && c instanceof ExpressionNode && c.concatTokens().toUpperCase().startsWith("BIT-") === false)) {
    return true;
  }

  const call = BuiltInCall.fromSource(operand, input);
  if (call === undefined || BuiltInCall.isNumeric(call) === false) {
    return false;
  }
  const argument = call.findDirectExpression(Expressions.MethodCallParam)?.findDirectExpression(Expressions.Source);
  return argument === undefined || BuiltInCall.isDataObject(withoutParentheses(argument)) === false;
}
