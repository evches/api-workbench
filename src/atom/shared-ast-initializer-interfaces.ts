import rp=require("@evches/raml-1-parser");
import hl=rp.hl;
import ll=rp.ll;

/**
 * Provides current AST state.
 * If set via setASTProvider method, will be used instead of a new AST calculation
 * by parsing the text provided by IEditorProvider.
 */
export interface IASTProvider {

    /**
     * Gets current AST root.
     */
    getASTRoot() : hl.IHighLevelNode;

    /**
     * Gets current AST node
     */
    getSelectedNode() : hl.IParseResult;
}

/**
 * Position in text.
 */
export interface IPoint {
    row:number;
    column:number;
}

/**
 * Range of positions in text.
 */
export interface IRange {
    start:IPoint;
    end:IPoint;
}

/**
 * Text editor buffer.
 */
export interface IEditorTextBuffer {

    /**
     * Gets position by the offset from the beginning of the document.
     * @param offset
     */
    positionForCharacterIndex(offset:number):IPoint

    /**
     * Gets offset from the beginning of the document by the position
     * @param position
     */
    characterIndexForPosition(position:IPoint):number;

    /**
     * Gets a range for the row number.
     * @param row - row number
     * @param includeNewline - whether to include new line character(s).
     */
    rangeForRow(row:number, includeNewline?:boolean):IRange;

    /**
     * Gets text in range.
     * @param range
     */
    getTextInRange(range:IRange):string;

    /**
     * Sets (replacing if needed) text in range
     * @param range - text range
     * @param text - text to set
     * @param normalizeLineEndings - whether to convert line endings to the ones standard for this document.
     */
    setTextInRange(range:IRange, text:string, normalizeLineEndings?:boolean):IRange;

    /**
     * Returns buffer text.
     */
    getText(): string;

    /**
     * Gets buffer end.
     */
    getEndPosition():IPoint;
}

/**
 * Abstract text editor, able to provide document text buffer and cursor position.
 */
export interface IAbstractTextEditor {
    /**
     * Returns complete text of the document opened in the editor.
     */
    getText() : string;

    /**
     * Gets text buffer for the editor.
     */
    getBuffer() : IEditorTextBuffer;

    /**
     * Gets file path.
     */
    getPath();

    /**
     * Returns current cursor position
     */
    getCursorBufferPosition() : IPoint;

    /**
     * Sets editor text.
     * @param text
     */
    setText(text:string);
}

/**
 * Provider, which can return current text editor
 */
export interface IEditorProvider {

    /**
     * Returns current text editor.
     */
    getCurrentEditor() : IAbstractTextEditor
}

/**
 * Provider for AST modifications.
 */
export interface IASTModifier {

    /**
     * Deletes node
     * @param node
     */
    deleteNode(node: hl.IParseResult);

    /**
     * Updates text for the give node.
     * @param node
     */
    updateText(node: ll.ILowLevelASTNode);
}