// global vars
var fileLocation = "platforms/android/gradle.properties";
var preferenceName = "UA_SKIP_GOOGLE_SERVICES";
var gradlePropertyName = "uaSkipApplyGoogleServicesPlugin";

module.exports = function (context) {
    const fs = context.requireCordovaModule("fs");
    var utils = require("./utils");

    function addGradleProperty (libLoc, pref, value) {
        console.log('Applying preference to gradle.properties "' + pref + '" =' + value);
        fs.appendFileSync(libLoc, '\n' + pref + '=' + value);
    }

    const val = utils.getPreference(context, 'android', 'UA_SKIP_GOOGLE_SERVICES');
    if (val) {
        addGradleProperty(fileLocation, gradlePropertyName, val);
    } else {
        console.log("No preference 'UA_SKIP_GOOGLE_SERVICES' found in config.xml. Using default value 'false'");
        addGradleProperty(fileLocation, gradlePropertyName, false);
    }
};
