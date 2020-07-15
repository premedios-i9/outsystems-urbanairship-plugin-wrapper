var path = require("path");
var fs = require("fs");
var et = require("elementtree");
var plist = require('plist');

/**
 * Get the platform version for the current execution
 * @param {object} context
 * @returns {string} platform version
 */
function getPlatformVersion (context) {
    var projectRoot = context.opts.projectRoot;
    var platformsJsonFile = path.join(
        projectRoot,
        "platforms",
        "platforms.json"
    );
    var platforms = require(platformsJsonFile);
    var platform = context.opts.plugin.platform;
    return platforms[platform];
}

function rmNonEmptyDir (dir_path) {
    if (fs.existsSync(dir_path)) {
        fs.readdirSync(dir_path).forEach(function (entry) {
            var entry_path = path.join(dir_path, entry);
            if (fs.lstatSync(entry_path).isDirectory()) {
                rmNonEmptyDir(entry_path);
            } else {
                fs.unlinkSync(entry_path);
            }
        });
        fs.rmdirSync(dir_path);
    }
}

/**
 * Get the full path to the platform directory
 * @param {object} context Cordova context
 * @returns {string} absolute path to platforms directory
 */
function getPlatformPath (context) {
    var projectRoot = context.opts.projectRoot;
    var platform = context.opts.plugin.platform;
    return path.join(projectRoot, "platforms", platform);
}

/**
 * Get absolute path to the www folder inside the platform
 * and not the root www folder from the cordova project.
 * Example:
 *     - Android: project_foo/platforms/android/app/src/main/assets/www
 *     - iOS: project_foo/platforms/ios/www
 * @param {string} platform
 */
function getWwwPath (context) {
    var platformPath = getPlatformPath(context);
    var platform = context.opts.plugin.platform;
    var wwwfolder;
    if (platform === "android") {
        var platformVersion = getPlatformVersion(context);
        if (platformVersion >= "7") {
            wwwfolder = "app/src/main/assets/www";
        } else {
            wwwfolder = "assets/www";
        }
    } else if (platform === "ios") {
        wwwfolder = "www";
    }
    return path.join(platformPath, wwwfolder);
}

let rootdir;
let configXmlData;

function getPreference (context, platform, prefName) {
    rootdir = context.opts.projectRoot;
    const preferences = getPreferences(platform, 'config.xml');
    for (i = 0; i < preferences.length; i++) {
        if (prefName.toLowerCase() === preferences[i].attrib.name.toLowerCase()) {
            return ((!preferences[i].attrib.value || preferences[i].attrib.value === '') ? preferences[i].attrib.default : preferences[i].attrib.value);
        }
    }
    return;
}

// Parses a given file into an elementtree object
function parseElementtreeSync (filename) {
    var contents = fs.readFileSync(filename, 'utf-8');
    if (contents) {
        //Windows is the BOM. Skip the Byte Order Mark.
        contents = contents.substring(contents.indexOf('<'));
    }
    return new et.ElementTree(et.XML(contents));
}

// Converts an elementtree object to an xml string.  Since this is used for plist values, we don't care about attributes
function eltreeToXmlString (data) {
    const tag = data.tag;
    let el = '<' + tag + '>';

    if (data.text && data.text.trim()) {
        el += data.text.trim();
    } else {
        data.getchildren().forEach(function (child) {
            el += eltreeToXmlString(child);
        });
    }

    el += '</' + tag + '>';
    return el;
}

// Parses the config.xml into an elementtree object and stores in the config object
function getConfigXml (file) {
    if (!configXmlData) {
        configXmlData = parseElementtreeSync(file);
    }

    return configXmlData;
}

/* Retrieves all <preferences ..> from config.xml and returns a map of preferences with platform as the key.
   If a platform is supplied, common prefs + platform prefs will be returned, otherwise just common prefs are returned.
 */
function getPreferences (platform, file) {
    const configXml = getConfigXml(file);
    let preferencesData = {
        common: configXml.findall('preference')
    };
    let prefs = preferencesData.common || [];
    if (platform) {
        if (!preferencesData[platform]) {
            preferencesData[platform] = configXml.findall('platform[@name=\'' + platform + '\']/preference');
        }
        prefs = prefs.concat(preferencesData[platform]);
    }

    return prefs;
}

/* Retrieves all configured xml for a specific platform/target/parent element nested inside a platforms config-file
   element within the config.xml.  The config-file elements are then indexed by target|parent so if there are
   any config-file elements per platform that have the same target and parent, the last config-file element is used.
 */
function getConfigFilesByTargetAndParent (platform) {
    const configFileData = getConfigXml().findall('platform[@name=\'' + platform + '\']/config-file');

    let result = {};

    configFileData.forEach(function (item) {

        let parent = item.attrib.parent;
        //if parent attribute is undefined /* or */, set parent to top level elementree selector
        if (!parent || parent === '/*' || parent === '*/') {
            parent = './';
        }
        const key = item.attrib.target + '|' + parent;

        result[key] = item;
    });

    return result;
}

// Parses the config.xml's preferences and config-file elements for a given platform
function parseConfigXml (platform) {
    const configData = {};
    parsePreferences(configData, platform);
    parseConfigFiles(configData, platform);

    return configData;
}

// Retrieves the config.xml's pereferences for a given platform and parses them into JSON data
function parsePreferences (configData, platform) {
    const preferences = getPreferences(platform, path.join(rootdir, 'config.xml')),
        type = 'preference';

    preferences.forEach(function (preference) {
        // check if there are specific configuration to map to config for platform
        if (!preferenceMappingData[platform]) {
            return;
        }
        const prefMappingData = preferenceMappingData[platform][preference.attrib.name];
        let target,
            prefData;

        if (prefMappingData) {
            prefData = {
                parent: prefMappingData.parent,
                type: type,
                destination: prefMappingData.destination,
                data: preference
            };

            target = prefMappingData.target;
            if (!configData[target]) {
                configData[target] = [];
            }
            configData[target].push(prefData);
        }
    });
}

// Retrieves the config.xml's config-file elements for a given platform and parses them into JSON data
function parseConfigFiles (configData, platform) {
    const configFiles = getConfigFilesByTargetAndParent(platform),
        type = 'configFile';

    for (let key in configFiles) {
        if (configFiles.hasOwnProperty(key)) {
            const configFile = configFiles[key];

            const keyParts = key.split('|');
            const target = keyParts[0];
            const parent = keyParts[1];
            const items = configData[target] || [];

            configFile.getchildren().forEach(function (element) {
                items.push({
                    parent: parent,
                    type: type,
                    destination: element.tag,
                    data: element
                });
            });

            configData[target] = items;
        }
    }
}

// Parses config.xml data, and update each target file for a specified platform
function updatePlatformConfig (platform) {
    const configData = parseConfigXml(platform),
        platformPath = path.join(rootdir, 'platforms', platform);

    for (let targetFileName in configData) {
        if (configData.hasOwnProperty(targetFileName)) {
            const configItems = configData[targetFileName];

            let projectName, targetFile;

            if (platform === 'ios' && targetFileName.indexOf("Info.plist") > -1) {
                projectName = getConfigXml().findtext('name');
                targetFile = path.join(platformPath, projectName, projectName + '-Info.plist');
                updateIosPlist(targetFile, configItems);
            } else if (platform === 'android' && targetFileName === 'AndroidManifest.xml') {
                targetFile = getAndroidManifestFilePath(rootdir);
                updateAndroidManifest(targetFile, configItems);
            }
        }
    }
}

function getMainAndroidActivityNode (rootManifest) {
    const cordovaApp = "application/activity/intent-filter/action[@android:name='android.intent.action.MAIN']/../..";
    const tempNode = rootManifest.find(cordovaApp);
    return tempNode;
}

// Updates the AndroidManifest.xml target file with data from config.xml
function updateAndroidManifest (targetFile, configItems) {
    const tempManifest = parseElementtreeSync(targetFile),
        root = tempManifest.getroot();
    const mainActivity = getMainAndroidActivityNode(root);

    configItems.forEach(function (item) {

        let parentEl;
        if (item.parent === "__cordovaMainActivity__") {
            parentEl = mainActivity;
        } else {
            // if parent is not found on the root, child/grandchild nodes are searched
            parentEl = root.find(item.parent) || root.find('*/' + item.parent);
        }

        const data = item.data;
        let childSelector = item.destination,
            childEl;

        if (!parentEl) {
            return;
        }

        if (item.type === 'preference') {
            parentEl.attrib[childSelector] = data.attrib['value'];
        } else {
            // since there can be multiple uses-permission elements, we need to select them by unique name
            if (childSelector === 'uses-permission') {
                childSelector += '[@android:name=\'' + data.attrib['android:name'] + '\']';
            }

            childEl = parentEl.find(childSelector);
            // if child element doesnt exist, create new element
            if (!childEl) {
                childEl = new et.Element(item.destination);
                parentEl.append(childEl);
            }

            if (typeof data === "object") {
                // copy all config.xml data except for the generated _id property
                for (let key in data) {
                    // skip loop if the property is from prototype
                    if (!data.hasOwnProperty(key)) {
                        continue;
                    }

                    if (key !== '_id') {
                        childEl[key] = data[key];
                    }
                }
            }
        }
    });

    fs.writeFileSync(targetFile, tempManifest.write({ indent: 4 }), 'utf-8');
    console.log("Wrote AndroidManifest.xml: " + targetFile);
}

/* Updates the *-Info.plist file with data from config.xml by parsing to an xml string, then using the plist
   module to convert the data to a map.  The config.xml data is then replaced or appended to the original plist file
 */
function updateIosPlist (targetFile, configItems) {
    const infoPlist = plist.parse(fs.readFileSync(targetFile, 'utf-8'));
    let tempInfoPlist;

    configItems.forEach(function (item) {
        const key = item.parent;
        const plistXml = '<plist><dict><key>' + key + '</key>' +
            eltreeToXmlString(item.data) + '</dict></plist>';

        const configPlistObj = plist.parse(plistXml);
        infoPlist[key] = configPlistObj[key];
    });

    tempInfoPlist = plist.build(infoPlist);
    tempInfoPlist = tempInfoPlist.replace(/<string>[\s\r\n]*<\/string>/g, '<string></string>');
    fs.writeFileSync(targetFile, tempInfoPlist, 'utf-8');
    console.log("Wrote iOS Plist: " + targetFile);
}

module.exports = {
    getPlatformVersion: getPlatformVersion,
    rmNonEmptyDir: rmNonEmptyDir,
    getPlatformPath: getPlatformPath,
    getWwwPath: getWwwPath,
    getPreference: getPreference
};
