/*
 * Formatter for Selenium 2 / WebDriver Java client.
 */

if (!this.formatterType) {  // this.formatterType is defined for the new Formatter system
    // This method (the if block) of loading the formatter type is deprecated.
    // For new formatters, simply specify the type in the addPluginProvidedFormatter() and omit this
    // if block in your formatter.
    var subScriptLoader = Components.classes["@mozilla.org/moz/jssubscript-loader;1"].getService(Components.interfaces.mozIJSSubScriptLoader);
    subScriptLoader.loadSubScript('chrome://selenium-ide/content/formats/webdriver.js', this);
}

// small modification from webdriver.js
// override since we want to actually handle waitForPageToLoad
this.postFilter = function (originalCommands) {
    var commands = [];
    var commandsToSkip = {
        'waitForPageToLoad': 0, // webdriver skips this
        'pause': 1
    };
    var rc;
    for (var i = 0; i < originalCommands.length; i++) {
        var c = originalCommands[i];
        if (c.type == 'command') {
            if (commandsToSkip[c.command] && commandsToSkip[c.command] == 1) {
                //Skip
            } else if (rc = SeleneseMapper.remap(c)) {  //Yes, this IS an assignment
                //Remap
                commands.push.apply(commands, rc);
            } else {
                commands.push(c);
            }
        } else {
            commands.push(c);
        }
    }
    return commands;
};

var simpleCommands = {
    "waitForPageToLoad" : 0,
    "waitForTextPresent" : 1,
    "verifyTextPresent" : 1,
    "assertConfirmation" : 1
};

origFormatCommand = formatCommand;
formatCommand = function (command) {
    var srcCommand = command.remapped || command;
    var simpleCommandArgCount = simpleCommands[srcCommand.command];
    if (simpleCommandArgCount != undefined) {
        if (simpleCommandArgCount === 0) {
            return srcCommand.command + '();';
        }
        return srcCommand.command + '("' + srcCommand.target.replace('"', '\\"').replace('\n', '\\n') + '");';
    }
    if (command.command.match(/^waitFor/)) {
        if (command.value) {
            command.value = 'locator=' + command.target + ', value=' + command.value;
        } else {
            command.value = 'locator=' + command.target;
        }
        command.target = command.command;
        command.command = 'rollup';
    }
    return origFormatCommand(command);
};

function useSeparateEqualsForArray() {
    return true;
}

function testClassName(testName) {
    return testName.split(/[^0-9A-Za-z]+/).map(
        function (x) {
            return capitalize(x);
        }).join('');
}

function testMethodName(testName) {
    return "test" + testClassName(testName);
}

function nonBreakingSpace() {
    return "\"\\u00a0\"";
}

function array(value) {
    var str = 'new String[] {';
    for (var i = 0; i < value.length; i++) {
        str += string(value[i]);
        if (i < value.length - 1) str += ", ";
    }
    str += '}';
    return str;
}

function autoComplete(locator, searchValue, selectValue) {
    var driver = new WDAPI.Driver();
    return driver.findElement(locator.type, locator.string).autoComplete(searchValue, selectValue);
}

function combobox(locator, value) {
    var driver = new WDAPI.Driver();
    return driver.findElement(locator.type, locator.string).combobox(value);
}

// support some deprecated commands
SeleniumWebDriverAdaptor.prototype.keyPress = SeleniumWebDriverAdaptor.prototype.sendKeys;
SeleniumWebDriverAdaptor.prototype.keyUp = SeleniumWebDriverAdaptor.prototype.sendKeys;

SeleniumWebDriverAdaptor.prototype.rollup = function(elementLocator) {
    var target = this.rawArgs[0];
    var args = this.rawArgs[1].split(',');
    var loc = args[0].trim();
    if (loc.indexOf('locator=') === 0) {
        loc = loc.substr(8);
    }
    var rollupArgs = [];
    for (var a = 1; a < args.length; ++a) {
        rollupArgs.push(args[a].trim().split('=')[1]);
    }

    var locator = this._elementLocator(loc);
    var driver = new WDAPI.Driver();
    return driver.findElement(locator.type, locator.string).rollup(target, rollupArgs);
};

SeleniumWebDriverAdaptor.prototype.type = function(elementLocator, text) {
  var locator = this._elementLocator(this.rawArgs[0]);
  var driver = new WDAPI.Driver();
  return driver.findElement(locator.type, locator.string).type(this.rawArgs[1]);
};

Equals.prototype.toString = function () {
    if (this.e1.toString().match(/^\d+$/)) {
        // int
        return this.e1.toString() + " == " + this.e2.toString();
    } else {
        // string
        return this.e1.toString() + ".equals(" + this.e2.toString() + ")";
    }
};

Equals.prototype.assert = function () {
    return "assertEquals(" + this.e1.toString() + ", " + this.e2.toString() + ");";
};

Equals.prototype.verify = function () {
    return verify(this.assert());
};

NotEquals.prototype.toString = function () {
    return "!" + this.e1.toString() + ".equals(" + this.e2.toString() + ")";
};

NotEquals.prototype.assert = function () {
    return "assertThat(" + this.e1.toString() + ", is(not(" + this.e2.toString() + ")));";
};

NotEquals.prototype.verify = function () {
    return verify(this.assert());
};

function joinExpression(expression) {
    return "join(" + expression.toString() + ", ',')";
}

function statement(expression) {
    var s = expression.toString();
    if (s.length == 0) {
        return null;
    }
    return s + ';';
}

function assignToVariable(type, variable, expression) {
    return type + " " + variable + " = " + expression.toString();
}

function ifCondition(expression, callback) {
    return "if (" + expression.toString() + ") {\n" + callback() + "}";
}

function assertTrue(expression) {
    return "assertTrue(" + expression.toString() + ");";
}

function assertFalse(expression) {
    return "assertFalse(" + expression.toString() + ");";
}

function verify(statement) {
    return "try {\n" +
        indents(1) + statement + "\n" +
        "} catch (Error e) {\n" +
        indents(1) + "verificationErrors.append(e.toString());\n" +
        "}";
}

function verifyTrue(expression) {
    return verify(assertTrue(expression));
}

function verifyFalse(expression) {
    return verify(assertFalse(expression));
}

RegexpMatch.prototype.toString = function () {
    if (this.pattern.match(/^\^/) && this.pattern.match(/\$$/)) {
        return this.expression + ".matches(" + string(this.pattern) + ")";
    } else {
        return "Pattern.compile(" + string(this.pattern) + ").matcher(" + this.expression + ").find()";
    }
};

function assertOrVerifyFailure(line, isAssert) {
    var message = '"expected failure"';
    var failStatement = "fail(" + message + ");";
    return "try { " + line + " " + failStatement + " } catch (Throwable e) {}";
}

function pause(milliseconds) {
    return "Thread.sleep(" + parseInt(milliseconds, 10) + ");";
}

function echo(message) {
    return "System.out.println(" + xlateArgument(message) + ");";
}

function formatComment(comment) {
//    if (comment.comment.match(/^Warning: .* may require manual changes$/)) {
//        return '';
//    }
    return comment.comment.replace(/.+/mg, function (str) {
        return "// " + str;
    });
}

function keyVariable(key) {
    return "Keys." + key;
}

this.sendKeysMaping = {
    BKSP: "BACK_SPACE",
    BACKSPACE: "BACK_SPACE",
    TAB: "TAB",
    ENTER: "ENTER",
    SHIFT: "SHIFT",
    CONTROL: "CONTROL",
    CTRL: "CONTROL",
    ALT: "ALT",
    PAUSE: "PAUSE",
    ESCAPE: "ESCAPE",
    ESC: "ESCAPE",
    SPACE: "SPACE",
    PAGE_UP: "PAGE_UP",
    PGUP: "PAGE_UP",
    PAGE_DOWN: "PAGE_DOWN",
    PGDN: "PAGE_DOWN",
    END: "END",
    HOME: "HOME",
    LEFT: "LEFT",
    UP: "UP",
    RIGHT: "RIGHT",
    DOWN: "DOWN",
    INSERT: "INSERT",
    INS: "INSERT",
    DELETE: "DELETE",
    DEL: "DELETE",
    SEMICOLON: "SEMICOLON",
    EQUALS: "EQUALS",

    NUMPAD0: "NUMPAD0",
    N0: "NUMPAD0",
    NUMPAD1: "NUMPAD1",
    N1: "NUMPAD1",
    NUMPAD2: "NUMPAD2",
    N2: "NUMPAD2",
    NUMPAD3: "NUMPAD3",
    N3: "NUMPAD3",
    NUMPAD4: "NUMPAD4",
    N4: "NUMPAD4",
    NUMPAD5: "NUMPAD5",
    N5: "NUMPAD5",
    NUMPAD6: "NUMPAD6",
    N6: "NUMPAD6",
    NUMPAD7: "NUMPAD7",
    N7: "NUMPAD7",
    NUMPAD8: "NUMPAD8",
    N8: "NUMPAD8",
    NUMPAD9: "NUMPAD9",
    N9: "NUMPAD9",
    MULTIPLY: "MULTIPLY",
    MUL: "MULTIPLY",
    ADD: "ADD",
    PLUS: "ADD",
    SEPARATOR: "SEPARATOR",
    SEP: "SEPARATOR",
    SUBTRACT: "SUBTRACT",
    MINUS: "SUBTRACT",
    DECIMAL: "DECIMAL",
    PERIOD: "DECIMAL",
    DIVIDE: "DIVIDE",
    DIV: "DIVIDE",

    F1: "F1",
    F2: "F2",
    F3: "F3",
    F4: "F4",
    F5: "F5",
    F6: "F6",
    F7: "F7",
    F8: "F8",
    F9: "F9",
    F10: "F10",
    F11: "F11",
    F12: "F12",

    META: "META",
    COMMAND: "COMMAND"
};

/**
 * Returns a string representing the suite for this formatter language.
 *
 * @param testSuite  the suite to format
 * @param filename   the file the formatted suite will be saved as
 */
function formatSuite(testSuite, filename) {
    var suiteClass = /^(\w+)/.exec(filename)[1];
    suiteClass = suiteClass[0].toUpperCase() + suiteClass.substring(1);

    var formattedSuite = "import junit.framework.Test;\n"
        + "import junit.framework.TestSuite;\n"
        + "\n"
        + "public class " + suiteClass + " {\n"
        + "\n"
        + indents(1) + "public static Test suite() {\n"
        + indents(2) + "TestSuite suite = new TestSuite();\n";

    for (var i = 0; i < testSuite.tests.length; ++i) {
        var testClass = testSuite.tests[i].getTitle();
        formattedSuite += indents(2)
            + "suite.addTestSuite(" + testClass + ".class);\n";
    }

    formattedSuite += indents(2) + "return suite;\n"
        + indents(1) + "}\n"
        + "\n"
        + indents(1) + "public static void main(String[] args) {\n"
        + indents(2) + "junit.textui.TestRunner.run(suite());\n"
        + indents(1) + "}\n"
        + "}\n";

    return formattedSuite;
}

function defaultExtension() {
    return this.options.defaultExtension;
}

this.options = {
    receiver: "driver",
    environment: "lasc",
    packageName: "com.sustain.it",
    indent: '4',
    initialIndents: '2',
    showSelenese: 'false',
    defaultExtension: "java"
};

options.header =
    "package ${packageName}.${environment};\n" +
        "\n" +
        "import com.sustain.it.common.IntegrationTest;\n" +
        "import org.openqa.selenium.By;\n" +
        "import org.openqa.selenium.WebElement;\n" +
        "import org.junit.*;\n" +
        "import static org.junit.Assert.*;\n" +
        "\n" +
        "public class ${className}IT extends IntegrationTest {\n" +
        indents(1) + "@Test\n" +
        indents(1) + "public void ${methodName}() {\n";

options.footer =
    indents(1) + "}\n" +
    "}\n";

this.configForm =
    '<description>Variable for Selenium instance</description>' +
        '<textbox id="options_receiver" />' +
        '<description>Package</description>' +
        '<textbox id="options_packageName" />' +
        '<description>Environment</description>' +
        '<textbox id="options_environment" />' +
        '<description>Header</description>' +
        '<textbox id="options_header" multiline="true" flex="1" rows="4"/>' +
        '<description>Footer</description>' +
        '<textbox id="options_footer" multiline="true" flex="1" rows="4"/>' +
        '<description>Indent</description>' +
        '<menulist id="options_indent"><menupopup>' +
        '<menuitem label="Tab" value="tab"/>' +
        '<menuitem label="1 space" value="1"/>' +
        '<menuitem label="2 spaces" value="2"/>' +
        '<menuitem label="3 spaces" value="3"/>' +
        '<menuitem label="4 spaces" value="4"/>' +
        '<menuitem label="5 spaces" value="5"/>' +
        '<menuitem label="6 spaces" value="6"/>' +
        '<menuitem label="7 spaces" value="7"/>' +
        '<menuitem label="8 spaces" value="8"/>' +
        '</menupopup></menulist>' +
        '<checkbox id="options_showSelenese" label="Show Selenese"/>';

this.name = "eCourt JUnit 4 (WebDriver)";
this.testcaseExtension = ".java";
this.suiteExtension = ".java";
this.webdriver = true;

WDAPI.Driver = function () {
    this.ref = options.receiver;
};

WDAPI.Driver.searchContext = function (locatorType, locator, list) {
    var locatorString = xlateArgument(locator);
    if (locatorType == 'tag_name') {
        locatorType = 'tagName';
    }
    if (locatorType == 'css') {
        locatorType = 'cssSelector';
    }
    return locatorType + (list ? 's' : '') + '(' + locatorString + ')';
};

WDAPI.Driver.prototype.back = function () {
    return this.ref + ".navigate().back()";
};

WDAPI.Driver.prototype.close = function () {
    return this.ref + ".close()";
};

WDAPI.Driver.prototype.findElement = function (locatorType, locator) {
    return new WDAPI.Element(WDAPI.Driver.searchContext(locatorType, locator));
};

WDAPI.Driver.prototype.findElements = function (locatorType, locator) {
    return new WDAPI.ElementList(WDAPI.Driver.searchContext(locatorType, locator, true));
};

WDAPI.Driver.prototype.getCurrentUrl = function () {
    return this.ref + ".getCurrentUrl()";
};

WDAPI.Driver.prototype.get = function (url) {
    if (url.length > 1 && (url.substring(1, 8) == "http://" || url.substring(1, 9) == "https://")) { // url is quoted
        return this.ref + ".get(" + url + ")";
    } else {
        return "gotoPage(" + url + ")";
    }
};

WDAPI.Driver.prototype.getTitle = function () {
    return this.ref + ".getTitle()";
};

WDAPI.Driver.prototype.getAlert = function () {
    return "closeAlertAndGetItsText()";
};

WDAPI.Driver.prototype.chooseOkOnNextConfirmation = function () {
    return "acceptNextAlert = true";
};

WDAPI.Driver.prototype.chooseCancelOnNextConfirmation = function () {
    return "acceptNextAlert = false";
};

WDAPI.Driver.prototype.refresh = function () {
    return this.ref + ".navigate().refresh()";
};

WDAPI.Element = function (ref) {
    this.ref = ref;
};

WDAPI.Element.prototype.clear = function () {
    return this.ref + ".clear()";
};

WDAPI.Element.prototype.click = function () {
    return this.ref + ".click()";
};

WDAPI.Element.prototype.getAttribute = function (attributeName) {
    return this.ref + ".getAttribute(" + xlateArgument(attributeName) + ")";
};

WDAPI.Element.prototype.getText = function () {
    return this.ref + ".getText()";
};

WDAPI.Element.prototype.isDisplayed = function () {
    return this.ref + ".isDisplayed()";
};

WDAPI.Element.prototype.isSelected = function () {
    return this.ref + ".isSelected()";
};

WDAPI.Element.prototype.sendKeys = function (text) {
    return "sendKeys(" + this.ref + ", " + xlateArgument(text) + ")";
};

WDAPI.Element.prototype.type = function (text) {
    return "type(" + this.ref + ", " + xlateArgument(text) + ")";
};

WDAPI.Element.prototype.rollup = function (target, rollupArgs) {
    var loc = this.ref;
    if (target.match(/^waitFor/)) {
        loc = 'By.' + loc;
    }
    if (rollupArgs.length > 0) {
        return target + "(" + loc + ", \"" + rollupArgs.join("\", \"") + "\")";
    } else {
        return target + "(" + loc + ")";
    }
};

WDAPI.Element.prototype.submit = function () {
    return this.ref + ".submit()";
};

WDAPI.Element.prototype.select = function (selectLocator) {
    if (selectLocator.type == 'index') {
        return "selectByIndex(" + this.ref + ", " + selectLocator.string + ")";
    }
    if (selectLocator.type == 'value') {
        return "selectByValue(" + this.ref + ", " + xlateArgument(selectLocator.string) + ")";
    }
    return "selectByLabel(" + this.ref + ", " + xlateArgument(selectLocator.string) + ")";
};

WDAPI.ElementList = function (ref) {
    this.ref = ref;
};

WDAPI.ElementList.prototype.getItem = function (index) {
    return this.ref + "[" + index + "]";
};

WDAPI.ElementList.prototype.getSize = function () {
    return this.ref + ".size()";
};

WDAPI.ElementList.prototype.isEmpty = function () {
    return this.ref + ".isEmpty()";
};

WDAPI.Utils = function () {
};

WDAPI.Utils.isElementPresent = function (how, what) {
    return "isElementPresent(" + WDAPI.Driver.searchContext(how, what) + ")";
};

WDAPI.Utils.isAlertPresent = function () {
    return "isAlertPresent()";
};
