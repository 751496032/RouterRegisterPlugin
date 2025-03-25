/**
 * @author: HZWei
 * @date: 2024/12/5
 * @desc:
 */
import ts, { isClassDeclaration, isIdentifier, isStructDeclaration } from "ohos-typescript";

export default class NodeHelper {

    static getClassName(node: ts.Node) {
        let className = ""
        if (isClassDeclaration(node) || isStructDeclaration(node)) {
            if (node.name && isIdentifier(node.name)) {
                className = node.name.escapedText ?? ""
            }
        }
        return className
    }


    static getBooleanByKind(kind: ts.SyntaxKind) {
        let value = false
        if (kind && kind === ts.SyntaxKind.FalseKeyword) {
            value = false
        } else if (kind && kind === ts.SyntaxKind.TrueKeyword) {
            value = true
        }
        return value
    }
}
