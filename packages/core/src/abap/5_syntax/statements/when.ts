import * as Expressions from "../../2_statements/expressions";
import {ExpressionNode, StatementNode, TokenNode} from "../../nodes";
import {Source} from "../expressions/source";
import {Compare} from "../expressions/compare";
import {StatementSyntax} from "../_statement_syntax";
import {SyntaxInput, syntaxIssue} from "../_syntax_input";
import {TypeUtils} from "../_type_utils";
import {BuiltIn} from "../_builtin";
import {BuiltInCall} from "../_builtin_call";
import {checkCaseOperand} from "./case";

export class When implements StatementSyntax {
  public runSyntax(node: StatementNode, input: SyntaxInput): void {

    // the values the CASE operand is compared with, "WHEN a OR b"
    const values = [...node.findDirectExpressions(Expressions.Source),
      ...node.findDirectExpressions(Expressions.Or).map(o => o.findDirectExpression(Expressions.Source))];
    const typeUtils = new TypeUtils(input.scope);
    const calculated: ExpressionNode[] = [];

    for (const s of node.findAllExpressions(Expressions.Source)) {
      const type = Source.runSyntax(s, input);
      if (values.includes(s) === false) {
        continue;
      }

      const message = this.checkCalculation(s, input);
      if (message !== undefined) {
        calculated.push(s);
        input.issues.push(syntaxIssue(input, s.getFirstToken(), message));
      } else if (typeUtils.hasComparisonType(input.caseOperand?.type, type) === false) {
        input.issues.push(syntaxIssue(input, s.getFirstToken(), "Incompatible types for comparison"));
      }
    }
    for (const s of node.findDirectExpressions(Expressions.Source)) {
      if (calculated.includes(s) === false) {
        checkCaseOperand(s, input);
      }
    }

  }

  // a value after WHEN cannot be calculated, unlike the operand of CASE: no arithmetic, string or bit expression, no
  // parentheses, no table expression, and of the built-in functions only numeric ones with one unnamed argument,
  // which is a data object. A literal joined with "&" is a single literal, "'a' & 'b'"
  private checkCalculation(source: ExpressionNode, input: SyntaxInput): string | undefined {
    if (Compare.isArithmetic(source, input)) {
      return "Arithmetic expression not allowed after WHEN";
    }
    const children = source.getChildren();
    const first = children[0];
    if (first instanceof TokenNode && first.getFirstToken().getStr() === "(") {
      return "Parentheses not allowed after WHEN";
    } else if (children.some(c => c instanceof TokenNode && c.getFirstToken().getStr() === "&&")
        || first?.get() instanceof Expressions.StringTemplate) {
      return "String expression not allowed after WHEN";
    } else if (/^BIT-NOT /i.test(source.concatTokens())
        || children.some(c => c.get() instanceof Expressions.ArithOperator)) {
      // the lexer splits BIT-NOT into three tokens, the arithmetic operators are reported above
      return "Bit expression not allowed after WHEN";
    } else if (children.some(c => (c.get() instanceof Expressions.FieldChain || c.get() instanceof Expressions.MethodCallChain)
        && c instanceof ExpressionNode && c.findDirectExpression(Expressions.TableExpression) !== undefined)) {
      return "Table expression not allowed after WHEN";
    } else if (first instanceof TokenNode && /^(BOOLC|XSDBOOL)$/i.test(first.getFirstToken().getStr())) {
      return `Built-in function "${first.getFirstToken().getStr()}" not allowed after WHEN, only a numeric function`;
    }

    const call = BuiltInCall.fromSource(source, input);
    if (call === undefined) {
      return undefined;
    }
    const name = BuiltInCall.callName(call);
    if (BuiltInCall.isNumeric(call) === false) {
      return `Built-in function "${name}" not allowed after WHEN, only a numeric function`;
    }
    if (BuiltIn.hasUnnamedArgument(name) && BuiltInCall.hasDataObjectArgument(call)) {
      return undefined;
    }
    return `Built-in function "${name}" not allowed after WHEN, only a function of a data object`;
  }
}
