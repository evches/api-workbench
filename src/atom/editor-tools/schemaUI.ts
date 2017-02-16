/// <reference path="../../../typings/main.d.ts" />

import UI=require("atom-ui-lib")
import khttp=require ("know-your-http-well");
import path=require('path')
import Disposable = UI.IDisposable
import CompositeDisposable = UI.CompositeDisposable
import rp=require("@evches/raml-1-parser")
import fs=require("fs")
import Opt=require("../../Opt")
import assistUtils = require("../dialogs/assist-utils");
import details2=require("../editor-tools/details2")
import contextActions = require("@evches/raml-actions")
import commonContextActions = require("../context-menu/commonContextActions")
import details=require("../editor-tools/details")
import _=require("underscore")
import pair = require("../../util/pair");
import schemautil=rp.schema;
export class SchemaRenderer implements UI.ICellRenderer<any> {
    render(elem: any) : UI.BasicComponent<any> {
        var icon : UI.Icon;
        var tc : UI.TextClasses;
        switch (elem.type) {
            case 'object' :
                icon = UI.Icon.CIRCUIT_BOARD;
                tc  = UI.TextClasses.INFO;
                break;
            case 'array':
                icon = UI.Icon.LIST_UNORDERED;
                tc = UI.TextClasses.ERROR;
                break;
            case 'unspecified':
                icon = UI.Icon.QUESTION;
                tc = UI.TextClasses.WARNING;
                break;
            default:
                icon = UI.Icon.CODE;
                tc = UI.TextClasses.SUCCESS;
        }

        return UI.hc(UI.label(elem.name + ": ", icon), UI.label(elem.type, null, tc, null).pad(4, 0));
    }
}

export function _schemaPreview(): UI.TreeViewer<any, any> {
    var hashkey = n => {
        if (n == null) return "";
        return hashkey(n.parent) + "::[" + (n.name + ":" + n.type + "]" + (n.children.length > 0 ? "*" : ""));
    }

    var treeViewer = UI.treeViewer(x=> x.children, new SchemaRenderer(), x=> x.name + ":" + x.type);
    treeViewer.setComparator((x, y) => x.name == y.name && x.type == y.type);

    return treeViewer;

}

export function getSchemaTree(name: string, contents: any): any {
    if (contents.type instanceof Array)
        if (contents.type.indexOf('object') >= 0) contents.type = 'object';
        else if (contents.type.indexOf('array') >= 0) contents.type = 'array';

    var typeString = contents.type ? (contents.type instanceof Array ? contents.type.join("|") : contents.type).toLowerCase() : 'unspecified';

    var children = [];
    if (contents.properties)
        children = Object.keys(contents.properties).map(el => getSchemaTree(el, contents.properties[el]));
    else if (contents.items)
        children = contents.items instanceof Array ? contents.items.map(el => getSchemaTree("item", el)) : getSchemaTree("item", contents.items);
    if (children instanceof Array == false) children = [children];

    var result = {
        type: typeString,
        name: name,
        parent: null,
        children: children
    };

    result.children.forEach(x=>x.parent = result);
    return result;
}
export function _updatePreview(treeView: UI.TreeViewer<any, any>, value: string) {
    try {
        var schema = schemautil.createSchema(value, null);
        if (schema == null || schema.getType == null) {
            treeView.setInput({},true);
            return;
        }
        var schemaType = schema.getType();

        var schemaModel = schemaType == "source.json" ? JSON.parse(value) : rootElements(value);
        var schemaTree = schemaType == "source.json" ?  getSchemaTree("schema", schemaModel) : getXMLSchemaTree(schemaModel);

        treeView.setInput(schemaTree, true);
    } catch(e) {
        console.log(e);
    }
}
var jsonix = require('jsonix')

function parseSchema(schema:string):string {
    var XSD_1_0 = require('w3c-schemas').XSD_1_0;
    var context = new jsonix.Jsonix.Context([XSD_1_0]);
    var unmarshaller = context.createUnmarshaller();
    var schemaObject = unmarshaller.unmarshalString(schema);
    return schemaObject;
};
 function rootElements(schema: string) {
    var schemaObj = parseSchema(schema);
    return getRootElements(schemaObj);
}

class TypeDescription{

    constructor(
        protected owner:any,
        protected _name:string,
        protected _isSimple:boolean,
        protected _object:any) {}

    name = ():string => this._name ;

    isSimple = ():boolean => this._isSimple;

    object = ():any => this._object;

    isChoice():boolean{
        return this.object && (this.object['choice'] ||
            (this.object['complexContent'] &&this.object['complexContent']['choice']) )
    }

    elements():PropertyDescription[]{
        var elementObjects:any[] = []
        if(this._object) {
            elementObjects = this.collectElements(this._object);
            if (elementObjects.length==0) {
                var complexContent = this.object['complexContent']
                if (complexContent) {
                    elementObjects = this.collectElements(complexContent);
                }
            }
        }
        var result:PropertyDescription[] = elementObjects.map(x=>new ElementDescription(this.owner,x));
        return result;
    }

    attributes():PropertyDescription[]{
        var result:PropertyDescription[] = [];
        var objects = [ this._object ];
        for(var i = 0 ; i < objects.length; i++ ){
            var obj = objects[i];
            if(!obj){
                continue;
            }
            if(obj['attributeGroup']){
                var attributeGroups = obj['attributeGroup'].filter(x=>x['otherAttributes']);
                for(var j = 0 ; j < attributeGroups.length ; j++) {
                    var groupRef = attributeGroups[j]['otherAttributes']['ref'];
                    var groupDef = this.owner.attributeGroups[groupRef];
                    objects.push(groupDef);
                }
            }
            if(obj['attribute']){
                obj['attribute'].forEach(x=>result.push(new AttributeDescription(this.owner,x)));
            }
        }
        return result;
    }

    base():Opt<TypeDescription>{

        if(!this._object){
            return Opt.empty<TypeDescription>();
        }

        var baseObj;

        if(this._object['restriction']){
            var restriction = this._object['restriction'];
            baseObj = restriction['base'];
        }
        else if(this._object['complexContent']){
            var complexContent = this.object['complexContent'];
            var resExt = complexContent['restriction'] || complexContent['extension'];
            if(resExt){
                baseObj = resExt['base'];
            }
        }
        if(!baseObj){
            return Opt.empty<TypeDescription>();
        }

        var typeName = extractName(baseObj);
        var isSimple = false;
        var typeObject

        var sType = this.owner.simpleTypes[typeName];
        if(sType){
            typeObject = sType;
            isSimple = true;
        }
        var cType = this.owner.complexTypes[typeName];
        if(cType){
            typeObject = cType;
        }
        if((typeName.indexOf('xs:')==0||typeName.indexOf('xsd:')==0)) {
            if(typeName.substring(typeName.indexOf(':')+1)!='any'){
                isSimple = true;
            }
        }

        var result:TypeDescription = new TypeDescription(this.owner,typeName,isSimple,typeObject);
        return new Opt<TypeDescription>(result);
    }

    getBaseName():string{
        var typeOpt:Opt<TypeDescription> = new Opt<TypeDescription>(this);
        var result = '';
        while(typeOpt.isDefined()){
            var t:TypeDescription = typeOpt.getOrThrow();
            result = t.name();
            typeOpt = t.base();
        }
        return result;
    }

    private collectElements(obj:any){
        var result:any = [];
        var containers:any[] = [ obj['sequence'], obj['any'], obj['choice'] ];
        for(var i = 0 ; i < containers.length; i++){
            var x = containers[i];
            if(!x){
                continue;
            }
            if(x['group']){
                var groups = x['group'].filter(gr=>gr['otherAttributes']);
                for(var j = 0 ; j < groups.length; j++){
                    var groupRef= groups[j]['otherAttributes']['ref'];
                    var groupDef = this.owner.elementGroups[groupRef];
                    if(groupDef){
                        if(groupDef['sequence']){
                            containers = containers.concat(groupDef['sequence']);
                        }
                        if(groupDef['any']){
                            containers = containers.concat(groupDef['any']);
                        }
                        if(groupDef['choice']){
                            containers = containers.concat(groupDef['choice']);
                        }
                    }
                }
            }
            if(x['element']){
                result = result.concat(x['element'])
            }
            result = result.concat(this.collectElements(x));
        }
        return result;
    }
}

export class PropertyDescription{

    constructor(protected owner:any, protected _object:any){}

    name = ():string => this._object['name']

    type():Opt<TypeDescription>{

        var typeName
        var typeObject
        var isSimple = false;

        if(this._object['type']){
            var typeObj = this._object['type']
            typeName = extractName(typeObj);
            var sType = this.owner.simpleTypes[typeName];
            if(sType){
                typeObject = sType;
                isSimple = true;
            }
            var cType = this.owner.complexTypes[typeName];
            if(cType){
                typeObject = cType;
            }
            if((typeName.indexOf('xs:')==0||typeName.indexOf('xsd:')==0)) {
                if(typeName.substring(typeName.indexOf(':')+1)!='any'){
                    isSimple = true;
                }
            }
        }
        else if(this._object['complexType']){
            typeObject = this._object['complexType'];
        }
        else if(this._object['simpleType']){
            typeObject = this._object['simpleType'];
        }
        var result:TypeDescription = new TypeDescription(this.owner,typeName,isSimple,typeObject);
        return new Opt<TypeDescription>(result);
    }

    optional():boolean{
        throw new Error("This method is abstract.")
    }

    isArray():boolean{
        throw new Error("This method is abstract.")
    }

    isAttribute():boolean{
        return false;
    }
}
export class ElementDescription extends PropertyDescription{

    constructor(owner:any,object:any) {
        super(owner,object)
    }


    isArray():boolean{
        var otherAttributes = this._object['otherAttributes'];
        if(!otherAttributes){
            return false;
        }
        var maxOccurs = otherAttributes['maxOccurs']
        if(!maxOccurs){
            return false;
        }
        if(maxOccurs == 'unbounded'){
            return true;
        }
        try{
            var mo = parseInt(maxOccurs);
            return mo > 1
        }
        catch(e){}
        return false;
    }

    optional():boolean{
        var otherAttributes = this._object['otherAttributes'];
        if(!otherAttributes){
            return true;
        }
        var minOccurs = otherAttributes['minOccurs'];
        if(!minOccurs){
            return true;
        }
        try{
            var mo = parseInt(minOccurs);
            return mo == 0
        }
        catch(e){
        }
        return true;
    }
}
function extractName(typeObj) {
    var prefix = typeObj['prefix'];
    var localPart = typeObj['localPart'];
    var typeName = prefix + (prefix.length > 0 ? ':' : '') + localPart;
    return typeName;
};

export class AttributeDescription extends PropertyDescription {

    constructor(owner:any, object:any) {
        super(owner, object)
    }

    optional():boolean{
        var otherAttributes = this._object['otherAttributes'];
        if(!otherAttributes){
            return false;
        }
        var use = otherAttributes['use'];
        if(!use){
            return false;
        }
        return use != 'required';
    }

    isArray():boolean{
        return false;
    }

    isAttribute():boolean{
        return true;
    }
}

function getRootElements(obj) {

    var objValue = obj['value'];

    var result:ElementDescription[] = [];
    if (objValue) {

        var groups = objValue['group'];
        if (groups) {
            groups.forEach(x=>this.elementGroups[x.name] = x);
        }

        var attributeGroups = objValue['attributeGroup'];
        if (attributeGroups) {
            attributeGroups.forEach(x=>this.attributeGroups[x.name] = x);
        }

        var simpleTypes = objValue['simpleType'];
        if (simpleTypes) {
            simpleTypes.forEach(x=>this.simpleTypes[x.name] = x);
        }

        var complexTypes = objValue['complexType'];
        if (complexTypes) {
            complexTypes.forEach(x=>this.complexTypes[x.name] = x);
        }

        var rootElements = objValue['element'];
        if(rootElements){
            result = rootElements.map(x=>new ElementDescription(this,x));
        }
    }
    return result;
}
var XSD_2_TS_TYPE_MAP = {
    "ENTITIES": "string",
    "ENTITY": "string",
    "ID": "string",
    "IDREF": "string",
    "IDREFS": "string",
    "language": "string",
    "Name": "string",
    "NCName": "string",
    "NMTOKEN": "string",
    "NMTOKENS": "string",
    "normalizedString": "string",
    "QName": "string",
    "string": "string",
    "token": "string",
    "date": "string",
    "dateTime": "string",
    "duration": "string",
    "gDay": "string",
    "gMonth": "string",
    "gMonthDay": "string",
    "gYear": "string",
    "gYearMonth": "string",
    "time": "string",
    "anyURI": "string",
    "base64Binary": "string",
    "hexBinary": "string",
    "NOTATION": "string",
    "boolean": "boolean",
    "double": "number",
    "float": "number",
    "byte": "number",
    "decimal": "number",
    "int": "number",
    "integer": "number",
    "long": "number",
    "negativeInteger": "number",
    "nonNegativeInteger": "number",
    "nonPositiveInteger": "number",
    "positiveInteger": "number",
    "short": "number",
    "unsignedLong": "number",
    "unsignedInt": "number",
    "unsignedShort": "number",
    "unsignedByte": "number"
}

export function getTSType(xmltype: string) {
    return XSD_2_TS_TYPE_MAP[xmltype];
}

function getXMLSchemaTree(roots: ElementDescription[]) {
    var getSType = function(type: string) {
        if (!type) return 'Unknown';
        type = type.substr(type.indexOf(':') + 1);
        return getTSType(type);
    }
    return roots.map(root=> {
        var result;
        var t = root.type().value();
        if (root.isArray())
            result = {
                type: 'Array',
                name: root.name(),
                parent: null,
                children: getXMLSchemaTree(t.elements())
            };
        else if (t.isSimple())
            result = {
                type: getSType(t.name()),
                name: root.name(),
                parent: null,
                children: []
            };
        else
            result = {
                type: 'Object',
                name: root.name(),
                parent: null,
                children: getXMLSchemaTree(t.elements())
            };
        result.children.forEach(x=>x.parent = result);
        return result;
    });
}
