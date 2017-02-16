/// <reference path="../../../typings/main.d.ts" />

import UI=require("atom-ui-lib")
import khttp=require ("know-your-http-well");

/**
 * Created by kor on 13/05/15.
 */

import rp=require("@evches/raml-1-parser")

import path=require('path')
import Disposable = UI.IDisposable
import CompositeDisposable = UI.CompositeDisposable
import hl=rp.hl;
import defs=rp.ds;
import stubs=rp.stubs;

var services=defs

import search=rp.search;
import lowLevel=rp.ll;
import fs=require("fs")
import assistUtils = require("./assist-utils");
import details2=require("../editor-tools/details2")
import details=require("../editor-tools/details")
import editorTools=require("../editor-tools/editor-tools")
import schemaUI=require("../editor-tools/schemaUI")

import _=require("underscore")
import pair = require("../../util/pair");
import universeModule = rp.universes;
import universeHelpers = rp.universeHelpers;

var _dialogPanels: UI.Panel[] = [];

var remote = require("remote");

var dialog;

function getDialog() {
    if(!dialog) {
        try {
            dialog = remote.require("electron").dialog;
        } catch(e) {
            console.log(e.message);
        }
    }

    return dialog;
}

dialog = getDialog();

export function showError(message: string, details: string) {
    getDialog().showMessageBox(remote.getCurrentWindow(), { type: 'error', buttons: ['Okay'], title: 'Error', message: message, detail: details});
}
var _methodDescriptions = null;


function getMethodDescriptions() {
    if (!_methodDescriptions) {
        _methodDescriptions = Object.create(null);
        var methodsProperty = (<any> editorTools.aquireManager().ast.definition().property(
            universeModule.Universe10.Api.properties.resources.name)
            .range()).property(universeModule.Universe10.ResourceBase.properties.methods.name);
        var list = methodsProperty.enumOptions();
        khttp.methods.filter(x=>list.indexOf(x.method.toLowerCase()) > -1).forEach(method => {
            var desc = method.description.trim().match(/^\"(.*)\"$/)[1];
            _methodDescriptions[method.method.toLowerCase()] = desc ? desc : method.description;
        });
    }
    return _methodDescriptions;
}

var _statusCodeDescriptions = null;
export function getStatusCodeDescriptions() {
    if (!_statusCodeDescriptions) {
        _statusCodeDescriptions = Object.create(null);
        khttp.statusCodes.forEach(code => {
            var m, desc = code.description.trim();
            if (m = desc.match(/^\"(.*)\"/))
                desc = m[1];
            _statusCodeDescriptions[code.code] = desc;
        });
        _statusCodeDescriptions['7xx'] = "is for developer errors.";
    }
    return _statusCodeDescriptions;
}
export function newApi() {
    var title = "",
        version = "",
        baseUri = "",
        sample = true,
        raml1 = true;

    var tfTitle = new UI.TextField("API Title*", title, (e, v) => title = v);
    var tfVersion = new UI.TextField("Version", version, (e, v) => version = v);
    var tfBaseURI = new UI.TextField("Base URI", baseUri, (e, v) => baseUri = v);

    tfTitle.setTabIndex(100);
    tfTitle.margin(0,0,8,0);
    tfVersion.setTabIndex(101);
    tfVersion.margin(0,0,8,0);
    tfBaseURI.setTabIndex(102);
    tfBaseURI.margin(0,0,8,0);

    var cbSample = new UI.CheckBox("Create sample resource", null, (e, v) => sample = v);
    cbSample.setValue(sample);
    var cbRaml1 = new UI.CheckBox("Generate 1.0 model", null, (e, v) => raml1 = v);
    cbRaml1.setValue(raml1);

    var panel = UI.section("Create new API", UI.Icon.DASHBOARD, false, false,
        tfTitle, tfVersion, tfBaseURI, UI.hc(cbSample, cbRaml1).margin(0, 0, 12, 12));

    _dialog(panel, ()=> {
        if (title == '') {
            showError("Cannot create API", "Title must not be empty");
            return false;
        }
        editorTools.aquireManager().setText(assistUtils.createRAMLFile(title, version, baseUri, sample, raml1));
        return true;
    }, tfTitle)(this);
    tfTitle.getActualField().ui().focus();
}


var typeValues = function (parent) {
    var isSchema = false;
    var tp = parent.definition().universe().type(universeModule.Universe10.TypeDeclaration.name);
    if (!tp) {
        isSchema = true;
        tp = parent.definition().universe().type(universeModule.Universe08.BodyLike.name)
    }
    var sh = (<defs.NodeClass>tp).property(universeModule.Universe10.TypeDeclaration.properties.schema.name);
    var types = [];

    if (sh) {
        types =search.enumValues(<defs.Property>sh,parent);
    }
    return {isSchema: isSchema, types: types};
};
export function newMethod(parent: hl.IHighLevelNode, method?: string) {
    var mdesc = getMethodDescriptions()
    var cdesc = getStatusCodeDescriptions();

    var NO_RESPONCE = "No response";
    var NO_RESPONCE_BT = "No response body type";
    var code = null, bodyType = null;
    if (method == null) method = "get";


    var mdescLabel = new UI.LabelField();
    var cdescLabel = new UI.LabelField();

    [mdescLabel, cdescLabel].forEach(x=>x.addClass('wizard-description'));

    mdescLabel.getActualField().margin(0, 0, 18, 8);
    cdescLabel.getActualField().margin(0, 0, 8, 8);


    var methodSelect = new UI.SelectField("Method:", (e, v) => {
        method = v
        mdescLabel.setText(`Method ${v} ${mdesc[v]}`);
    }, null);
    methodSelect.getActualField().setOptions(Object.keys(mdesc));
    methodSelect.getActualField().setValue(method, true);

    var responseSelect = new UI.SelectField("Status code:", (e, v) => {
        if (v == NO_RESPONCE) {
            v = null;
            responseTypeSelect.getActualField().setValue(NO_RESPONCE_BT);
        }
        code = v;
        responseTypeSelect.setDisabled(v == null);
        cdescLabel.setText(v ? `Status code ${v} ${cdesc[v]}` : '');
    }, null);
    responseSelect.getActualField().setOptions([NO_RESPONCE].concat(Object.keys(cdesc)));

    var responseTypeSelect = new UI.SelectField("Generate default response with media type:", (e, v) => {
        if (v == NO_RESPONCE_BT) {
            v = null;
            typeOfValue.setDisabled(true)
        }
        else typeOfValue.setDisabled(false)
        bodyType = v;
    }, null);
    responseTypeSelect.getActualField().setOptions([NO_RESPONCE_BT, "application/json", "application/xml", "application/x-www-form-urlencoded"]);
    responseTypeSelect.setDisabled(true);
    responseTypeSelect.margin(0, 0, 0, 12);


    var realBodyType=null
    var bodyTypeSelect = new UI.SelectField("Generate default body with media type:", (e, v) => {
        if (v == NO_RESPONCE_BT) {
            v = null;
            bodyTypeOfValue.setDisabled(true)
        }
        else bodyTypeOfValue.setDisabled(false)
        realBodyType = v;
    }, null);
    bodyTypeSelect.getActualField().setOptions([NO_RESPONCE_BT, "application/json", "application/xml", "application/x-www-form-urlencoded"]);
    bodyTypeSelect.margin(0, 0, 0, 12);

    var actualType:string = null;
    var bodyTypeString: string=null;
    var typeOfValue = new UI.SelectField("Generate default response body with type:", (e, v) => {
        if (v == NO_RESPONCE_BT) v = null;
        actualType = v;
    }, null);
    typeOfValue.setDisabled(true);
    typeOfValue.margin(0, 0, 0, 12);
    var __ret=typeValues(parent);
    var isSchema = __ret.isSchema;
    var types = __ret.types;
    if (types) {
        types = [""].concat(types);
        typeOfValue.getActualField().setOptions(types);
    }
    var bodyTypeOfValue = new UI.SelectField("Generate default body with type:", (e, v) => {
        if (v == NO_RESPONCE_BT) v = null;
        bodyTypeString = v;
    }, null);
    bodyTypeOfValue.setDisabled(true);
    bodyTypeOfValue.margin(0, 0, 0, 12);
    var isSchema = __ret.isSchema;
    var types = __ret.types;
    if (types) {
        types = [""].concat(types);
        bodyTypeOfValue.getActualField().setOptions(types);
    }
    var responseSection = UI.section("");
    responseSection.addChild(UI.h3("Body"))
    responseSection.addChild(bodyTypeSelect);
    responseSection.addChild(bodyTypeOfValue)
    responseSection.addChild(UI.h3("Response"))
    responseSection.addChild(responseSelect);
    responseSection.addChild(cdescLabel);
    responseSection.addChild(responseTypeSelect);
    responseSection.addChild(typeOfValue);
    responseSection.ui();
    var panel = UI.section("Creating a new method", UI.Icon.CODE, false, false,
        methodSelect, mdescLabel, responseSection
    );


    var __ret = typeValues(parent);

    //panel.addChild(typeOfValue)

    _dialog(panel, ()=> {
        var oldNode = parent.elementsOfKind('methods').filter(el => (el.attr('method').value() == method))[0];
        if (oldNode) {
            showError(`Method ${method} already exists`, "Node contents will be overwritten");
            parent.remove(oldNode);
        }
        var methodNode = stubs.createMethodStub(parent, method);

        if (realBodyType){
            var bodyNode = stubs.createBodyStub(methodNode, realBodyType);
            if (bodyTypeString) {
                if (isSchema) {
                    bodyNode.attrOrCreate("schema").setValue(bodyTypeString);
                }
                else bodyNode.attrOrCreate("type").setValue(bodyTypeString);
            }
            methodNode.add(bodyNode)
        }
        if (code) {

            var codeNode = stubs.createResponseStub(methodNode, code);
            methodNode.add(codeNode);

            if (bodyType) {
                var bodyNode = stubs.createBodyStub(codeNode, bodyType);
                if (actualType) {
                    if (isSchema) {
                        bodyNode.attrOrCreate("schema").setValue(actualType);
                    }
                    else bodyNode.attrOrCreate("type").setValue(actualType);
                }
                codeNode.add(bodyNode);
            }

        }
        parent.add(methodNode);
        editorTools.updateAndSelect(methodNode);
        return true;
    })(this);
}
export function getStringValue(x : string | hl.IStructuredValue) : string {
    if (typeof <any>x ==="object") return (<hl.IStructuredValue>x).valueName();
    else return <string>x;
}



export function typeEditDialog(name: string, value: string | hl.IStructuredValue, node: hl.IHighLevelNode, onDone: (newValue: string | hl.IStructuredValue) => void) {
    var typePanel = UI.vc();

    typePanel.margin(8, 8, 20, 8);

    var typeProperty = node.definition().property(name);

    var toPropagate = svMap(node, name);

    var typeList = editorTools.aquireManager().ast.elementsOfKind("resourceType").map(x=>x.name());
    var typeName = getStringValue(value);
    var select = new UI.SelectField('Type: ', (e,v)=> {
        if (v == EMPTY_VALUE) {
            value = "";
            typePanel.clear();
            typePanel.addChild(UI.label("Select some type from the list above to show its additional properties", null, UI.TextClasses.HIGHLIGHT));
            return;

        }
        value = rp.utils.genStructuredValue(v, node, typeProperty);
        var typeNode =( (typeof <any>value) ==="object") ? (<hl.IStructuredValue>value).toHighLevel(<hl.IHighLevelNode>editorTools.aquireManager().ast) : null;
        propagateValues(typeNode, toPropagate);
        details.updateDetailsPanel(typeNode, typePanel);

        if (typeNode && typeNode.definition().allProperties().length == 0) {
            value = v;
        }
    });

    var EMPTY_VALUE = "(no value)";
    select.getActualField().setOptions([EMPTY_VALUE].concat(typeList));
    select.setPercentWidth(100);
    if (typeList.indexOf(typeName) < 0) {
        select.getActualField().setValue(EMPTY_VALUE);
        if (typeName != "") typePanel.addChild(UI.label("Type `" + typeName + "` does not exists", null, UI.TextClasses.ERROR).setStyle("display", "block"));
        typePanel.addChild(UI.label("Select some type from the list above to show its additional properties", null, UI.TextClasses.HIGHLIGHT));
    }
    else
        select.getActualField().setValue(typeName, true);

    var panel = UI.section("Editing type value `" + name + '`:', UI.Icon.CIRCUIT_BOARD, null, null, select, typePanel);
    return _dialog(panel, () => { onDone(value); return true; });
}
function svMap(node : hl.IHighLevelNode, attr: string) {
    try {
        var map = new pair.Map<any>();
        var values = node.attributes(attr).map(x=>x.value()).filter(x=>typeof x==="object");
        values.forEach(val=>(<hl.IStructuredValue>val).lowLevel().children().forEach(c=>map.set(c.key(), c.value())));
        return map;
    } catch (e) {
        return null;
    }
}



function propagateValues(node: hl.IHighLevelNode, map: pair.Map<string>) {
    if (!node || !map) return;
    map.pairs().forEach(pair => {
        if (node.definition().property(pair.key))
            node.attrOrCreate(pair.key).setValue(pair.value);
    });
}
export function getResourceParent(node: hl.IHighLevelNode) {
    if (!node || !node.property()) return null;
    if (universeHelpers.isResourcesProperty(node.property())) return node;
    return getResourceParent(node.parent());
}
export function enumEditDialog(name: string, value: string[], onDone: (values: string[]) => void) {
    var _cp = {
        elements: (model: string[]) => model,
        init: (viewer) => {},
        dispose: () => {}
    };

    var renderer = {
        render: (model: string) => UI.hc(
            UI.label(model, UI.Icon.GIT_COMMIT),
            UI.a("",(e)=>{
                value = value.filter(x=>x!=e.id());
                list.remove(e.id())
            }, UI.Icon.TRASHCAN).pad(8,8).setId(model)).addClass("outline")
    };


    var list = new UI.ListView(_cp, renderer);
    list.setBasicLabelFunction(x=>x);
    list.setInput(value, true);

    var text = UI.texfField("", "", x=> x).margin(0, 0, 4, 4);
    text.addKeyPressListener((i: UI.TextField,e: KeyboardEvent)=>{
        if (e.keyCode != 13) return;
        var b =i.getBinding();
        var newValue = <string> b.get();
        b.set("");
        value.push(newValue);
        list.setInput(value, true);
    });
    var panel = UI.section("Editing enum value `" + name + '`:', UI.Icon.LIST_UNORDERED, null, null,
        UI.h3("List of elements in enum:").margin(0, 0, 20, 0),
        list.margin(20,20),
        UI.h3("Add new element:").margin(0, 0, 20, 0),
        text
    );
    return _dialog(panel, ()=>{ onDone(value); return true; }, text); //
}
function calculatesParentURIPath(resource : hl.IHighLevelNode) {
    var result = resource.attrValue("relativeUri")
    if (!result) return null

    var current = getResourceParent(resource.parent());
    while (current) {
        var segment = current.attrValue("relativeUri")
        if (!segment) return null

        result = segment + result
        current = getResourceParent(current.parent());
    }
    return result
}
export function newResource(parent: hl.IHighLevelNode) {
    var uri : string = "/";

    var uriLable = ""

    var resourceParent = getResourceParent(parent)
    var parentsPath = null
    if (resourceParent) {
        parentsPath = calculatesParentURIPath(resourceParent);
        if (parentsPath) {
            uriLable = parentsPath
        }
    }

    var uriTF = uriTF = new UI.TextField(uriLable, uri, (e, v)=> {
        uri = v;
    });

    uriTF.margin(0, 0, 6, 12);

    var methods = {};

    var methodsPanel = UI.vc().margin(0,0,0,12);

    Object.keys(getMethodDescriptions())
        .forEach(val =>{

            var ch=new UI.CheckBox(val, null, x=>{
                if (methods[val]){
                    delete methods[val]
                }
                else {
                    methods[val] = x
                }
            }).addClass("checkbox-group");
            var hcp=UI.vc().margin(0,0,15,0);
            hcp.addChild(ch)
            var desc=val+":"+ getMethodDescriptions()[val];
            methodsPanel.addChild(
                UI.vc(hcp)

            )
            var label=UI.label(desc,UI.Icon.NONE,UI.TextClasses.SUBTLE).margin(5,10,-4,0);
            methodsPanel.addChild(label);

        });

    var node = stubs.createResourceStub(parent, uri);
    var resourceTypeProp=UI.select("type");

    var sm=search.globalDeclarations(parent).filter(x=>universeHelpers.isResourceTypeType(x.definition())&&!x.definition().getAdapter(services.RAMLService).isUserDefined());
    var options=sm.map(x=>rp.search.qName(x,parent));
    var options=[""].concat(options);
    resourceTypeProp.setOptions(options);
    //var resourceTypeProp = details.property2(node, "type");

    var panel =
        UI.section("Creating a new resource", UI.Icon.BOOK, false, false)

    panel.addChild(UI.label("New resource URI:"));
    panel.addChild(uriTF);
    panel.addChild(UI.label("Type:"));
    panel.addChild(resourceTypeProp);
    panel.addChild(UI.label("Add additional methods:").margin(0,0,18,6));
    panel.addChild(methodsPanel);



    _dialog(panel, () => {
        if (uri.indexOf('/') != 0) return false;


        node.attrOrCreate("relativeUri").setValue(uri);
        Object.keys(methods).filter(x=>methods[x]).forEach(method=>{
            var stub = stubs.createMethodStub(node, method);
            stub.attrOrCreate("method").setValue(method);
            node.add(stub);
        });
        var vl=resourceTypeProp.getValue();
        if (vl){
            node.attrOrCreate("type").setValue(vl);
        }
        parent.add(node);
        editorTools.updateAndSelect(node);
        return true;
    }, uriTF, true)(this);
    uriTF.getActualField().ui().focus();

    //(<UI.TextField>resourceTypeProp).hideLabel();
    if(!parentsPath) {
        uriTF.hideLabel();
    } else {
        uriTF.makeLabelNextToField();
    }
}
export function newNode(parent:hl.IHighLevelNode,title:string,property:string,key:string="key"){
    var name = "",
        type = "";
    if (parent==null){
        return;
    }
    if (property=="body"){
        key="application/json"
    }
    var stub=stubs.createStub(parent, property,key);

    var item=details2.buildItem(stub,true);
    item.setTitle(title);
    var panel=<UI.Panel>item.render({ showDescription:true});
    panel.margin(8, 8, 8, 8);
    _dialog(panel, ()=> {
        (<any>stub)._parent=null;
        (<any>stub.lowLevel())._unit=null;
        parent.add(stub);
        editorTools.updateAndSelect(stub);

        return true;
    }, null)(this);
}
export function traitsEditDialog(name: string, values: any[], node: hl.IHighLevelNode, onDone: (newMap) => void) {
    var toPropagate = svMap(node, name);

    var tabs = new UI.TabFolder();
    var sel = UI.vc(UI.h3("Enabled traits: ")).margin(10, 10, 0, 0);

    tabs.margin(0, 0, 20, 10);
    tabs.add("Traits", UI.Icon.FILE_SUBMODULE, sel);


    var traitProperty = node.definition().property(name);

    var ui = {};

    var index = 0;
    var returnv = node.root().elementsOfKind('traits').map(trait => {
        var traitName = trait.name();
        var traitValue = rp.utils.genStructuredValue(traitName, node, traitProperty);
        var traitNode = (typeof (<any>traitValue) ==="object") ? (<hl.IStructuredValue>traitValue).toHighLevel() : null;

        if (traitNode && traitNode.definition().allProperties().length == 0)
            traitValue = traitName;


        var returnee = {
            index: index,
            name: traitName,
            value: traitValue,
            enabled: values.filter(x => getStringValue(x) == traitName).length > 0
        }

        propagateValues(traitNode, toPropagate);
        var tcb = UI.checkBox(returnee.name, e=> {
            returnee.enabled = tcb.getValue();
            tabs.toggle(1 + returnee.index, returnee.enabled);
        });

        tcb.margin(12, 12);
        tcb.setValue(returnee.enabled);

        sel.addChild(tcb);

        var traitPanel = UI.vc();
        traitPanel.margin(8, 8, 20, 8);
        details.updateDetailsPanel(traitNode, traitPanel);
        tabs.add(traitName, UI.Icon.CIRCUIT_BOARD, traitPanel);
        tabs.toggle(1 + index, returnee.enabled);
        index += 1;
        return returnee;
    });

    var panel = UI.section("Editing trait value `" + name + "`:", UI.Icon.CIRCUIT_BOARD, null, null, tabs);
    return _dialog(panel, () => { onDone(returnv); return true; });
}
function getNewSchemaPath(schema: string) {
    return path.dirname(editorTools.aquireManager().ast.lowLevel().unit().absolutePath()) + '/' + (schema.length > 0 ? schema + '.raml' : "");
}
function schemaText(nameOrValue: string) {
    var schema =editorTools.aquireManager().ast.elementsOfKind("schemas").filter(sch=>sch.name() == nameOrValue)[0];
    return schema ? schema.value().value() : "";
}


export function schemaEditDialog(name: string, value: string, onDone: (newValue: string) => void) {
    var NEW_SCHEMA = "(New Schema)";

    var schemas = editorTools.aquireManager().ast.elementsOfKind("schemas").map(x=>x.name()); // list of all available schema names

    var refValue = schemas.indexOf(value) >= 0;
    var text = refValue ? _schemaText(value) : value;
    var sname = refValue ? value : "";
    var timeout = 0;

    var editor = smallEditor((e, v) => { timeout = 0 });
    var preview = schemaUI._schemaPreview();

    var intervalId = setInterval(() => {
        if (timeout++ < 5) return;
        timeout = 0;
        schemaUI._updatePreview(preview, editor.getValue());
    }, 100);

    var select = new UI.SelectField('Select schema: ', (e, v) => {
        sname = v;
        text = schemaText(v)
        _updateEditor(editor, text);
    });

    select.getActualField().setOptions([NEW_SCHEMA].concat(schemas));
    select.setPercentWidth(100);

    if (refValue) select.getActualField().setValue(sname);
    _updateEditor(editor, text);

    var tabs = new UI.TabFolder();
    tabs.add("Write", UI.Icon.FILE_TEXT, editor);
    tabs.add("Preview", UI.Icon.GIT_MERGE, preview);

    var panel = UI.section("Editing schema value `" + name + "`:", UI.Icon.MICROSCOPE, null, null,
        select, tabs);

    var NoSchema = ()=> {
        showError("No schema entered", "Please enter a valid schema or select one from the list before proceeding.");
        return false;
    };
    var InvalidSchema = () => {
        showError("Invalid schema", "Please fix the errors in the schema before saving it.");
        return false;
    };

    return _dialog2(panel, [
        {
            name: "Save as reference",
            highlight: UI.ButtonHighlights.INFO,
            action: () => {
                var newText = editor.getValue();
                var isChanged = (text != newText);

                if (!isChanged && sname == NEW_SCHEMA) return NoSchema();
                else if (validateSchema(newText) == false) return InvalidSchema();


                if (isChanged) {
                    var res = saveSchema(sname, newText);
                    if (res) {
                        onDone(res);
                        clearInterval(intervalId);
                        return true;
                    } else return false;
                } else {
                    onDone(sname);
                    clearInterval(intervalId);
                    return true;
                }
            }
        },
        {
            name: "Save as text",
            highlight: UI.ButtonHighlights.WARNING,
            action: () => {
                var newText = editor.getValue();
                var isChanged = (text != newText);

                if (newText == "") return NoSchema();
                else if (validateSchema(newText) == false) return InvalidSchema();

                select.getActualField().setValue(NEW_SCHEMA);
                sname = "Untitled";
                onDone(newText);
                clearInterval(intervalId);
                return true;
            }
        },
        {
            name: "Cancel",
            highlight: UI.ButtonHighlights.NO_HIGHLIGHT,
            action: () => { clearInterval(intervalId); return true; }
        }
    ]);
}
export function _updateEditor(editor: UI.AtomEditorElement, value: string) {
    var schema = rp.schema.createSchema(value, null);
    var schemaType = (schema == null || schema.getType == null) ? "text/plain" : schema.getType();

    editor.setGrammar(schemaType);
    editor.setText(value);
}
function validateSchema(schema: string) {
    return true;
}
function saveSchema(name: string, value: string) {
    var schema = rp.schema.createSchema(value, null);

    var filterJSON = {name: 'JSON schemas', extensions :['json']},
        filterXML  = {name: 'XML schemas', extensions :['xsd']},
        filterAll  = {name: 'All files', extensions: ['*']};

    var projectFolder = path.dirname(editorTools.aquireManager().ast.lowLevel().unit().absolutePath());

    var ext : string;
    var filter;
    switch (schema.getType()) {
        case 'source.json':
            filter = [filterJSON];
            ext = ".json";
            break;
        case 'text.xml':
            filter = [filterXML];
            ext = ".xsd";
            break;
        default:
            filter = [];
    }
    var result = getDialog().showSaveDialog(remote.getCurrentWindow(), {
        title: 'Save schema',
        defaultPath: path.resolve(projectFolder, "schemas", name + ext),
        filters: filter
    });
    if (result == null) return null;
    var fname = path.basename(result);
    var ename = path.extname(fname);
    var sname = fname.substr(0, fname.indexOf(ename));
    var rpath = path.relative(projectFolder, result);

    if (editorTools.aquireManager().ast.elementsOfKind("schemas").map(x=>x.name()).indexOf(sname) == -1)
        assistUtils.createGlobalSchemaFromNameAndContent(editorTools.aquireManager().ast.root(), sname, rpath, value, result);

    return sname;
}
export function markdown(name: string, values: string[], onDone: (newValue: string) => void) {
    var editor = new UI.AtomEditorElement(values.join('\n'), (e) => { });
    editor.margin(0, 0, 6, 12);
    editor.setMini(false);
    editor.setGrammar('source.gfm');

    var panel =
        UI.section("Editing markdown value `" + name + '`:', UI.Icon.FILE_TEXT, false, false,
            UI.h3("Please note that lines might be long enough so window would scroll.").margin(0, 0, 20, 0),
            editor
        );
    return _dialog(panel, () => { onDone(editor.getBinding().get()); return true; }, editor);
}
export function exampleEditorDialog(name: string, rpath: string, value: string, onDone: (newValue: string) => void) {
    var editor = smallEditor((e, v)=>{
        if (v.indexOf('xml') >0)
            editor.setGrammar('text.xml');
        else editor.setGrammar('source.json');
    });

    editor.setText(value);

    var projectPath = path.dirname(editorTools.aquireManager().getPath());

    var refPath = new UI.TextField("Referenced from", rpath, (e,v)=>rpath = v, null, "No reference path provided");

    refPath.addChild(new UI.Button("Browse", UI.ButtonSizes.SMALL, UI.ButtonHighlights.NO_HIGHLIGHT, null, ()=>{
        var res = UI.fdUtils.openFileDialogModal("Open a reference", path.resolve(projectPath, rpath), []);
        if (!res) return;
        refPath.getActualField().setText(path.relative(projectPath, rpath = res[0]));
        value = fs.readFileSync(res[0]).toString("UTF-8");
        editor.setText(value);
    }).margin(4, 0));

    var reui = refPath.getActualField().ui();
    reui.onclick = (e) => {
        reui.blur();
        if (reui.nextSibling['onclick']) reui.nextSibling['onclick'](e);
    }

    var refFrom = UI.vc(UI.h3("Referenced"));

    var panel = UI.section("Editing example value `" + name + "`:", UI.Icon.MICROSCOPE, null, null,
        refPath.margin(12, 12, 20, 12), editor.margin(12, 12, 20, 12));

    return _dialog2(panel, [
        {
            name: "Save as reference",
            highlight: UI.ButtonHighlights.INFO,
            action: () => {
                var newText = editor.getValue();
                if ((value != newText)) {
                    var res = saveExample(path.resolve(projectPath, rpath), newText);
                    if (res) {
                        onDone(path.relative(projectPath, res));
                        return true;
                    } else return false;
                } else {
                    onDone(rpath);
                    return true;
                }
            }
        },
        {
            name: "Save as text",
            highlight: UI.ButtonHighlights.WARNING,
            action: () => onDone(editor.getValue()) == undefined || true
        },
        {
            name: "Cancel",
            highlight: UI.ButtonHighlights.NO_HIGHLIGHT,
            action: () => true
        }
    ]);
}
var mdp = null;
function _closeDialog() {
    _dialogPanels.pop();
    if (_dialogPanels.length == 0)
        mdp.destroy();
    else
        mdp = atom.workspace.addModalPanel({item: _dialogPanels[_dialogPanels.length -1].ui() });
}
function saveExample(filePath: string, value: string) {
    var filterJSON = { name: 'JSON schemas', extensions: ['json'] },
        filterXML = { name: 'XML schemas', extensions: ['xsd'] },
        filterAll = { name: 'All files', extensions: ['*'] };

    var ext = value.indexOf('xml') < 0 ? 'json' : 'xml';

    var filename = UI.fdUtils.saveFileDialogModal('Save an example', filePath, [filterJSON, filterXML, filterAll]);
    if (filename) fs.writeFileSync(filename, value);
    return filename;
}

function _dialog2(panel: UI.Panel, actions: { name: string; isPrimary?:boolean;highlight: UI.ButtonHighlights; action: () => boolean}[], toFocus?: UI.UIComponent, stretch: boolean = false) {
    var buttonBar = UI.hc().setPercentWidth(100);

    actions.reverse().forEach(a => {
        var button = UI.button(a.name, UI.ButtonSizes.NORMAL, a.highlight, UI.Icon.NONE, x=> { if (a.action()) _closeDialog(); });
        if (a.isPrimary){
            var st=panel.getBinding().status();
            if (st) {
                if (st.code == UI.StatusCode.ERROR) {
                    button.setDisabled(true);
                }
            }
            panel.getBinding().addStatusListener((x)=>{
                var st = panel.getBinding().status();
                if (st) {
                    if (st.code != UI.StatusCode.ERROR) {
                        button.setDisabled(false);
                    }
                    else {
                        button.setDisabled(true);
                    }
                }
            })
        }
        button.setStyle("float", "right")
            .margin(4,10);

        buttonBar.addChild(button);
    });

    panel.addChild(buttonBar);

    var ui = panel.ui();

    return (e) => {
        _dialogPanels.push(panel);

        var eventListener = () => {
            if(!stretch) {
                return;
            }

            var parent = ui.parentElement;

            var height = document.body.clientHeight;

            if(!parent) {
                return;
            }

            var style = window.getComputedStyle(parent);

            ["paddingBottom", "paddingTop", "marginBottom", "marginTop"].forEach(property => {
                height -= parseFloat(style[property] || 0);
            });

            ui.style.height = height + "px";
            ui.style.overflowY = "scroll";
        }

        window.addEventListener('resize', eventListener);

        mdp = (<any>atom).workspace.addModalPanel({ item: ui});

        mdp.onDidDestroy(() => {
            window.removeEventListener('resize', eventListener);
        });

        eventListener();

        if (toFocus) toFocus.ui().focus();
    };
}

export function msg(m:string){
    showError(m,"");
}
export function smallEditor(onChange?: (e, v)=>void) {
    if (!onChange) onChange = (e, v) => {};
    var editor = new UI.AtomEditorElement("", onChange);
    editor.setMini(false);
    editor.setStyle("height", "400px");
    editor.setStyle("border", "solid");
    editor.setStyle("border-width", "1px");
    return editor;
}

function _schemaText(nameOrValue: string) {
    var schema = editorTools.aquireManager().ast.elementsOfKind("schemas").filter(sch=>sch.name() == nameOrValue)[0];
    return schema ? schema.value().value() : "";
}

function _dialog(panel: UI.Panel, onDone: () => boolean, toFocus?: UI.UIComponent, stretch: boolean = false) {
    return _dialog2(panel, [
        { name: "Ok",   isPrimary:true,    highlight: UI.ButtonHighlights.PRIMARY,         action: onDone },
        { name: "Cancel",   highlight: UI.ButtonHighlights.NO_HIGHLIGHT,    action: ()=>true }
    ], toFocus, stretch);
}
