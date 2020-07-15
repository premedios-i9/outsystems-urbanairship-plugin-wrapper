# README

Wrapper plugin for UrbanAirship Cordova plugin. The goal of this wrapper plugin is to add support for the OutSystems platform by making use of hooks to provide the necessary configurations (google-services.json/plist)

## OutSystems Customization
For Android, when using this plugin in an application with other plugins that make use of the Google Services Plugin, it is advisable to disable the application of this gradle plugin with the usage of the preference `UA_SKIP_GOOGLE_SERVICES` to true.

This can be achieved in Outsystems by appending an android preference to your APPLICATION module, under the Android preferences in the Extensibilities. 

### Example
We have an application that use this urban airship plugin AND the plugin [Firebase Mobile](https://www.outsystems.com/forge/component-overview/4991/firebase-mobile), that has hooks in place to apply the google-services.json file to the right place. We should add the preference to the Application extensibility:
```json
{
 "preferences": {
   "global": [
    ...
   ],
   "android": [
     {
       "name": "UA_SKIP_GOOGLE_SERVICES",
       "value": "true"
     }
   ],
   ...
 }
 ...
}
```

30/10/2019 - Updated urbanairship dependency to 7.6.0 and added hook to disable the GoogleServices plugin when requested


14/10/2018 - The pull request for [#265](https://github.com/urbanairship/urbanairship-cordova/issues/265) has been merged and the plugin has been published on npm with version 7.3.2.

13/10/2018 - As of this date, the published version of the plugin is invalid. The plugin has been published with invalid information, more details on [#265](https://github.com/urbanairship/urbanairship-cordova/issues/265). This forces us to use a "local" version of the plugin with the fixed version information.
