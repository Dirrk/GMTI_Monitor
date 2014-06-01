/**
 * Created by Derek Rada on 5/2/2014.
 */

// derek.app

var datacenter = ['moc', 'phx'];

var Sites = [
    'iis7.$datacenter$level.aimestasset.gmti.gbahn.net',
    'iis7.$datacenter$level.aimestingest.gmti.gbahn.net',
    'iis7.$datacenter$level.aimestpublic.gmti.gbahn.net',
    'iis7.$datacenter$level.aimestpublish.gmti.gbahn.net'
];

var ServiceInstances = [
    { level: 'Prod', text: '', svc: 'AIMECoreAPI-ProdIIS7API-$datacenter' },
    { level: 'Stage', text: '.stage', svc: 'AIMECoreAPI-StageIIS7API-MOC'},
    { level: 'QA', text: '.qa', svc: 'AIMECoreAPI-QAIIS7API-MOC'}
];


var apis = [
    "DealsWeb",
    "DealsRO",
    "DealsRW",
    "GISService",
    "Point",
    "Config",
    "Syndication",
    "GaiaWebDrop",
    "Search",
    "TaxonomyV4",
    "GAIA",
    "GSAFeedService",
    "GSAFeedServices",
    "UserV4",
    "UserAdminV4",
    "aime",
    "FeedService",
    "MobileService",
    "Weather",
    "AssetMetaData",
    "AssetMetaDataRW",
    "SportsData-service",
    "UxServices",
    "TaxonomyService",
    "UserService",
    "ElectionsServices",
    "WeatherServices",
    "BooksServices",
    "ConfigurationAdminServices",
    "ConfigurationServices",
    "GEMServices",
    "CruiseExperience",
    "SiteMap",
    "WSIWeatherServices"
];

var template = [
    "IIS7-AIMECoreAPI-Deploy-$api-service.cmd",
    "IIS7-AIMECoreAPI-$api-IISAppDir"
];

var tokenizeSilent = "–svcinst AIMECoreAPI-ProdIIS7API-MOC --template IIS7-AIMECoreAPI-Silent-Tokens.xml";
var tokenize = "–svcinst AIMECoreAPI-ProdIIS7API-MOC --template IIS7-AIMECoreAPI-Tokenize-File";

var finalize = [
  "--svcinst AIMECoreAPI-ProdIIS7API-MOC --template IIS7-AIMECoreAPI-Various-Exec-PerlScriptsSVC-Script",
  "–svcinst AIMECoreAPI-ProdIIS7API-MOC --template IIS7-AIMECoreAPI-IISReset-Script"
];

var commandStr = 'perl "C:\\Program Files (x86)\\GMTI\\SiteFactory\\bin\\sitefactory"';

exports.app = function (req, res) {

    res.send(200);

};