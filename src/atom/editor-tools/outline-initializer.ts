import ramlOutline = require("@evches/raml-outline")
import sharedAstInitializerInterfaces = require("../shared-ast-initializer-interfaces")
import rp=require("@evches/raml-1-parser")
import lowLevel=rp.ll;
import hl=rp.hl;
var universes=rp.universes
import outlineCommon = require("./outline-common")
import UI=require("atom-ui-lib")


export function initialize(
    editorProvider : sharedAstInitializerInterfaces.IEditorProvider,
    astProvider : sharedAstInitializerInterfaces.IASTProvider) {
    
    ramlOutline.setASTProvider(<any>astProvider);
    ramlOutline.initialize();
    ramlOutline.setKeyProvider(<any>outlineCommon.keyProvider);

    createCategories();

    createDecorations();
}

function createCategories() : void {
    ramlOutline.addCategoryFilter(outlineCommon.ResourcesCategory, <any>outlineCommon.isResource);
    ramlOutline.addCategoryFilter(outlineCommon.SchemasAndTypesCategory, <any>outlineCommon.isSchemaOrType);
    ramlOutline.addCategoryFilter(outlineCommon.ResourceTypesAndTraitsCategory, <any>outlineCommon.isResourceTypeOrTrait);
    ramlOutline.addCategoryFilter(outlineCommon.OtherCategory, <any>outlineCommon.isOther);
}

function createDecorations() : void {
    ramlOutline.addDecoration(ramlOutline.NodeType.ATTRIBUTE, {
        icon: UI.Icon[UI.Icon.ARROW_SMALL_LEFT],
        textStyle: UI.TextClasses[UI.TextClasses.NORMAL]
    });

    ramlOutline.addDecoration(ramlOutline.NodeType.RESOURCE, {
        icon: UI.Icon[UI.Icon.PRIMITIVE_SQUARE],
        textStyle: UI.TextClasses[UI.TextClasses.HIGHLIGHT]
    });

    ramlOutline.addDecoration(ramlOutline.NodeType.METHOD, {
        icon: UI.Icon[UI.Icon.PRIMITIVE_DOT],
        textStyle: UI.TextClasses[UI.TextClasses.WARNING]
    });

    ramlOutline.addDecoration(ramlOutline.NodeType.SECURITY_SCHEME, {
        icon: UI.Icon[UI.Icon.FILE_SUBMODULE],
        textStyle: UI.TextClasses[UI.TextClasses.NORMAL]
    });

    ramlOutline.addDecoration(ramlOutline.NodeType.ANNOTATION_DECLARATION, {
        icon: UI.Icon[UI.Icon.TAG],
        textStyle: UI.TextClasses[UI.TextClasses.HIGHLIGHT]
    });

    ramlOutline.addDecoration(ramlOutline.NodeType.TYPE_DECLARATION, {
        icon: UI.Icon[UI.Icon.FILE_BINARY],
        textStyle: UI.TextClasses[UI.TextClasses.SUCCESS]
    });

    ramlOutline.addDecoration(ramlOutline.NodeType.DOCUMENTATION_ITEM, {
        icon: UI.Icon[UI.Icon.BOOK],
        textStyle: UI.TextClasses[UI.TextClasses.NORMAL]
    });
}



