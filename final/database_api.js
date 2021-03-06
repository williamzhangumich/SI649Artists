/*
 Importing this script will set up and populate a local WebSQL db based on sql_artists/events/venues.
 Automatically import data source files
 */

// $(document).ready(function(){
//     setup_db();
// })

// check if db exists then populate or callback
function setup_db(){
    var db;
    //Web SQL is only supported by chrome and Safari
    //If using unsupported browser, prompt users to switch to Chrome
    if (!window.openDatabase) {
            //$.noConflict();
            $.blockUI({ 
                message: '<h1>Sorry, your browser is not supported.</h1>'
                +'<h3>Please try <a href=\'https://www.google.com/intl/en/chrome/browser/\'>Chrome</a></h3>',
                css: { 
                border: 'none', 
                padding: '15px', 
                backgroundColor: '#000', 
                '-webkit-border-radius': '10px', 
                '-moz-border-radius': '10px', 
                opacity: .5, 
                color: '#fff' 
            } });
    }else {
        // add the blockMessage div with progress bar (invisible now)
        var _body = document.getElementsByTagName('body') [0];
        var _div = document.createElement('div');
        _div.innerHTML = "<h1> Just a minute...</h1>"
                        + "<h3> Preloading Database </h3>"
                        +"<h3> You won't need to wait after this first time:)</h3>"
                        +"<h3 id='logInsert'>Loading Data</h3>"
                        +"<div id='progressbar'></div>  ";
        _div.setAttribute("id", "blockMessage");
        _div.style.display = "none";
        _body.appendChild(_div);
        $("#progressbar").progressbar({ value: 0 });
        
        //Open the web SQL db, create if does not exists
        db = openDatabase("lastfmDB", "1.0", "music events, artists and venues", 30*1024*1024);
        var count = 0;
        //try if table exist, if not, create and populate  
        db.transaction(function(transaction){
            var sql = "SELECT * FROM sqlite_master WHERE type='table' and name='ARTISTS'";
            transaction.executeSql((sql),[], function(transaction, results){
                count = results['rows']['length']
                if (count==0){ 
                    console.log("populate db");
                    jQuery.blockUI({ 
                        //show the block div
                        message: $('#blockMessage'),
                        css: { 
                        border: 'none', 
                        padding: '15px', 
                        backgroundColor: '#000', 
                        '-webkit-border-radius': '10px', 
                        '-moz-border-radius': '10px', 
                        opacity: .5, 
                        color: '#fff' 
                    } }); 
                    // import sqls, populateDB on callback
                    load_sql('sql_artists');
                    load_sql('sql_venues');
                    load_sql('sql_events', PopulateDB);
                }
                else {
                    /////////////////////////////////////////////////
                    ///SHOULD　ADD CALLBACKS IN HERE!!!!!!!!
                    //////////////////////////////////////////////
                    setup_controls();
                    // alert("use existing db - SHOULD ADD SET UP FUNCS IN CALLBACK HERE!!!!");
                    // test
                    //query_db("select count(*), b.city, b.country, c.genre from EVENTS a "+
                    //  " join VENUES b on a.venue_id = b.venue_id join ARTISTS c on c.name = "+
                    //  "a.headliner where c.genre='Pop' group by b.city, b.country order by count(*) DESC");
                }
            });             
        });
    }
}

//import datasource json and onload callback (populateDB)
function load_sql(source, callback){
    var head= document.getElementsByTagName('head')[0];
    var script= document.createElement('script');
    script.type= 'text/javascript';
    script.src= 'data/' + source+'.js';
    script.onreadystatechange = callback;
    script.onload = callback;
    head.appendChild(script);
}


//insert function
function insert_sql_block(transaction, sql, insert_index, len, type, successCallBack){
    transaction.executeSql((sql),[], function(transaction, results){
        successCallBack(insert_index, len, type);
    }); 
}

//lightspeed bulk insert based on js file with sql
function BulkInsert(type, db){
    var sqls;
    if (type=='ARTISTS'){
        sqls = sql_artists;
    } else if (type=='EVENTS'){
        sqls = sql_events;
    } else if (type=='VENUES'){
        sqls = sql_venues;
    }
    db.transaction(function(transaction){
       for (sql in sqls){
           insert_sql_block(transaction, sqls[sql], sql, sqls.length, type,
               //success callback - log progress bar
               function(insert_index, len, type){
                   //console.log(insert_index);
                   document.getElementById('logInsert').innerHTML='Processing '+type;
                   if (insert_index%10==0 || insert_index == len-1){
                       $( "#progressbar" ).progressbar("value", Math.round(insert_index/(len-1)*100) );
                   }
                   if (insert_index == len-1 && type=="EVENTS"){
                       // When events are completed loaded, add index for artists
                       document.getElementById('logInsert').innerHTML='Creating Index';
                       create_index(db);
                   }
               })
       }});
}

function create_index(db){
    db.transaction(function(transaction){
        transaction.executeSql("CREATE INDEX artist_id on ARTISTS(name);",[],
                            function(){
                                // alert("done");
                                //$.noConflict();
                                setup_controls();
                                jQuery.unblockUI();
                                //document.location.reload(true);
                            });
    });
}

//main function to populate db
var PopulateDB = function(){
    var db = openDatabase("lastfmDB", "1.0", "music events, artists and venues", 30*1024*1024);
    //$.noConflict();
    // Create tables
    db.transaction(function(transaction){
        transaction.executeSql("CREATE TABLE IF NOT EXISTS ARTISTS (" +
            "name TEXT NOT NULL, genre TEXT NOT NULL, listener INTEGER,"+
            "playcount INTEGER, mbid TEXT);");      
        transaction.executeSql("CREATE TABLE IF NOT EXISTS EVENTS (" +
            "event_id NOT NULL PRIMARY KEY, title TEXT NOT NULL,"+
            "date TEXT NOT NULL, headliner TEXT, venue_id INTEGER NOT NULL,"+
            "image TEXT, cancelled INTEGER);");
        transaction.executeSql("CREATE TABLE IF NOT EXISTS VENUES (" +
            "venue_id NOT NULL PRIMARY KEY, name TEXT NOT NULL,"+
            "city TEXT, postal TEXT, country TEXT, street TEXT, "+
            "lat DOUBLE, long DOUBLE, website TEXT);");
    });
    
    var errCallback = function(){
        console.log("Some error occured during Inserting");
    }

   //lightspeed insert
   BulkInsert('ARTISTS', db);
   BulkInsert('VENUES', db);
   BulkInsert('EVENTS', db);
   
}

//Main API to execute sql and return obj list
//ASYNC!!! PLEASE　USE CALLBACKS
//default callback is logging
function query_db(sql, callback){
    // if no callback, log result (default)
    callback = typeof callback !== 'undefined' ? callback : callback_log;
    var result_set = [];
    db_con = openDatabase("lastfmDB", "1.0", "music events, artists and venues", 30*1024*1024);
    db_con.transaction(function(transaction){
        transaction.executeSql((sql),[], function(transaction, results){
            $.each(results.rows, function(rowIndex){
                    var row = results.rows.item(rowIndex);
                    result_set.push(row);
                });
            //HERE the callback
            callback(result_set);
        }, function(transactoin, error){
            console.log("error processing: "+ sql);
        });             
    });
}

// the default callback for querydb
function callback_log(result){
        //for (i in result){
            console.log(result);
            //console.log(result[i]);
        //}
    }

function get_artist_geojson(artist, lower_date, upper_date, callback){
    
    var artist_sql = "select e.title, v.name, v.long, v.lat, count(*) as count "+
                        "from EVENTS e, VENUES v where e.headliner = '" + artist+
                        "' and v.venue_id = e.venue_id and e.cancelled = 0 and v.lat != 999 and v.long != 999 " +
                        "and strftime('%Y', date) between '" + lower_date + "' and '" + upper_date + "' group by v.venue_id";
    console.log(artist_sql);
    query_db(artist_sql, function(results) {
        callback_geojson(results, callback);
    });
}

function callback_geojson(results, callback){
    
    var features = [];
    for (row in results){
        //console.log(results[row]);
        var title = results[row]['title'];
        var name = results[row]['name'];
        var count = results[row]['count'];
        var longi = results[row]['long'];
        var lat = results[row]['lat'];
        var feature = { 
            "type": "Feature", 
            "properties": 
            { 
                "title": title, 
                "name": name, 
                "count": count
            }, 
            "geometry": { 
                "type": "Point", 
                "coordinates": [ longi, lat ] 
            } 
        }
        features.push(feature);
    }
    var artist_geojson = {
        "type": "FeatureCollection",
        "features": features,
    };
    
    console.log(artist_geojson);
    callback(artist_geojson);
}
//teaser query:)
//query_db("select count(*), b.city, b.country, c.genre from EVENTS a join VENUES b on a.venue_id = b.venue_id join ARTISTS c on c.name = a.headliner where c.genre='Pop' group by b.city, b.country order by count(*) DESC")
