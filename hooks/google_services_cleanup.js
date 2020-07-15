var path = require("path");
var utils = require("./utils");
module.exports = function(context) {
    return new Promise(function(resolve, reject) {

        const val = utils.getPreference(context, 'android', 'UA_SKIP_GOOGLE_SERVICES');
        if (!val) {
            var wwwpath = utils.getWwwPath(context);
            var configPath = path.join(wwwpath, "google-services");
            console.log("Cleaning up ", configPath);
            // clean up google-services folder from source directory in project
            utils.rmNonEmptyDir(configPath);
        } else {
            console.log("Skipping google services hooks due to 'UA_SKIP_GOOGLE_SERVICES' being true");
        }
        return resolve();
    });
};
