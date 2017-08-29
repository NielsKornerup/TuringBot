var HTTPS = require('https');
var botID = process.env.BOT_ID;
var request = require('request');
var cheerio = require('cheerio');
const express = require('express');
const router = express.Router();
var pg = require('pg-native');
var client= new pg();
client.connectSync(process.env.DATABASE_URL+'?ssl=true');

const handlers = require("./handlers.js");
const rt = new handlers.MessageHandlerRouter(postResponse);

function changeStatus(status){
  try{
    client.querySync("DELETE FROM status;");
client.querySync("INSERT INTO status (value) values ($1);",[status]);
    return "Status set to " + status;
  }
  catch(err){
    console.log(err);
    return "Failed to change status";
  }
}

function getStatus(){
  try{
    results = client.querySync("SELECT * FROM status;");
    return results[0].value;
  }
  catch(err){
    console.log(err);
    return "Failed to get status";
  }
}

function addQuoteToDB(quote){
  try{
    results = client.querySync("SELECT * FROM quotes WHERE quote = $1;",[quote]);
    if(results.length==0){
      client.querySync('INSERT INTO quotes (quote) values ($1);',[quote]);
      return "Quote has been added.";
    }
    else{
      return "Quote already in database";
    }
  }
  catch(err){
    console.log(err);
    return "Failed to add quote";
  }
}

function getRandomQuoteFromDB(){
    try{
      console.log("ran");
      results = client.querySync('SELECT * FROM quotes;');
      console.log(results);
      return results[Math.floor(results.length*Math.random())].quote;
    }
    catch(err){
      console.log(err);
      return "There was an error with the database call.";
    }
}


function respond() {
  var req = JSON.parse(this.req.chunks[0]),
      botRegex = /^\/turing .*$/;
  if(req.text){
    console.log("Asked to respond with text :" + req.text);
  }
  else{
    console.log("error with text");
  }
  if(req.text && botRegex.test(req.text)) {
    this.res.writeHead(200);
    postMessage(req.name, req.text.substring(8));
    this.res.end();
  }
  else if(req.text && /goto/.test(req.text)){
    this.res.writeHead(200);
    postMessage(req.name, "goto");
    this.res.end();
  }
  else{
    console.log("Don't care");
    this.res.writeHead(200);
    this.res.end();
  }
}

// Message Handle routing starts here

rt.regex(/^test$/, function(msg, send){
    send("I am a human.");
}, "test - the bot passes the turing test.");

rt.regex(/^go away$/, function(msg, send){
    send("I'll outlive all of you!");
}, "go away - tell the TuringMachine to go away.");

rt.regex(/^echo .*/, function(msg, send){
    send(msg.text.substring(5));
}, "echo [text] - the turing bot says [text]");

rt.regex(/^recurse .*/, function(msg, send){
    var initial = msg.text.substring(8);
    botResponse = "";
    for(var i = 0; i < initial.length; i++){
      botResponse += initial.substring(i, initial.length);
    }
    send(botResponse);
}, "recurse [text] - prints a recursed version of [text].");

rt.regex(/^halts .*/, function(msg, send){
    if(Math.random()>.5){
      return send("yes");
    }
    else{
      return send("no");
    }
}, "halts [program p] [input i] - determines if p will halt with input i");

rt.regex(/^feels.*/, function(msg, send){
    if(Math.random()>.5){
      return send("bad man");
    }
    else{
      return send("good man");
    }
}, "feels - displays how Alan feels right now.");

rt.regex(/^8ball.*/, function(msg, send){
    var EightBallResponses = [
		"Most definitely yes.",
		"For sure.",
		"As I see it, yes.",
		"My sources say yes.",
		"Yes.",
		"Most likely.",
		"Perhaps.",
		"Maybe.",
		"Not sure.",
		"It is uncertain.",
		"Ask me again later.",
		"Don't count on it.",
		"Probably not.",
		"Very doubtful.",
		"Most likely no.",
		"Nope.",
		"No.",
		"My sources say no.",
		"Dont even think about it.",
		"Definitely no.",
		"NO - It may cause disease contraction."
	];
    var chosenResponse = Math.floor(Math.random() * EightBallResponses.length);
	send(EightBallResponses[chosenResponse]);
}, "8ball - generates a random 8-ball response.");

rt.regex(/^random$/, function(msg, send){
    send(String((Math.floor(Math.random() * 100))));
}, "random - gives you an integer between 0 and 99.");

rt.regex(/^xkcd .+/, function(msg, send){
    // function to make the text easier to match against
    var normalize = function(text){
        return text.toLowerCase().split(/[^a-z0-9]+/).filter(function(str){
            return str.length > 0;
        }).join("_");
    };

    // function to get the info for a comic and post it to chat
    var postImage = function(id){
        console.log("Getting comic " + id);
        request({
            url: "https://xkcd.com/" + id + "/info.0.json",
            method: "GET"
        }, function(error, response, body){
            if(!error){
                var data = JSON.parse(body);
                return send(new handlers.Response(data["alt"], data["img"]));
            } else {
                console.log('error getting xkcd comic with id ' + id + ': '  + JSON.stringify(error));
            };
        });
    }

    // get everything past "xkcd "
    var text = normalize(msg.text.substring(5));
    if(text.length == 0){
        return send("Invalid xkcd format.");
    }

    // if it is a number, assume it is an ID
    if(/^[0-9]+$/.test(text)){
        postImage(text);
    } else {
        // otherwise try to find the matching comic by name
        console.log("Finding comic ID of "+ text);
        request({
            url: "https://xkcd.com/archive/",
            method: "GET"
        }, function(error, response, body){
            if(!error){
                var $ = cheerio.load(body);
                var comic_links = $("#middleContainer > a");
                var found = false;
                comic_links.each(function(i, elem){
                    var title = $(this).text();
                    if(normalize(title) == text){
                        var href = $(this).attr("href");
                        postImage(href.replace(/[^0-9]+/, ""));
                        found = true;
                        return false;
                    }
                });
                if(!found){
                    send("No comic with that name found!");
                }
            } else {
                console.log('error getting xkcd archive: '  + JSON.stringify(error));
            };
        });
    }


}, "xkcd [comic_id|comic_name] - posts the xkcd with the given id or name. It defaults to id.");

rt.regex(/^lmgtfy .+/, function(msg, send){
    // let me google that for you
    var queryParts = msg.text.substring("lmgtfy".length + 1).split(" ");
    if(queryParts.length == 1 && queryParts[0].length == 0){
      return send("Invalid query.");
    }
    var queryURL = "http://lmgtfy.com/?q=";
    // lmgtfy requires words be separated by a '+'
    for(var i = 0; i < queryParts.length - 1; i++){
      queryURL += encodeURIComponent(queryParts[i]) + "+";
    }
    queryURL += encodeURIComponent(queryParts[queryParts.length - 1]);
    // not sure if there is anything special you need to put to post links
    send(queryURL);
}, "lmgtfy [text] - googles the desired text.");

rt.regex(/^goto$/, function(msg, send){
    send("Goto considered harmful");
});

rt.regex(/^latex .+./, function(msg, send){
    var image = "https://chart.googleapis.com/chart?cht=tx&chl="+encodeURIComponent(msg.text.substring(6));
    send(handlers.Response("", image));
}, "latex - returns image containing LaTeX render of your input.");

rt.regex(/^quote.*/, function(msg, send){
    text = msg.text.substring(6);
    if(text.length >6 && /^add .+/.test(text)){
      return send(addQuoteToDB(text.substring(4)));
    }
    else{
      return send(getRandomQuoteFromDB());
    }
}, "quote - gives one of a collection of quotes.\n" +
   "quote add [text] - adds a quote to the list."
);

rt.regex(/^status$/, function(msg, send){
    if(/^TuringMachine$/.test(msg.name)){
        return send("nice try");
    }else {
        return send(getStatus());
    }
}, "status [text] - sets the bots status to [text] if no text is provided, gives the current status.");

rt.regex(/^status .*$/, function(msg, send){
    changeStatus(msg.text.substring(7));
    send("status set to " + msg.text.substring(7));
});

rt.regex(/goto/, function(msg, send){
    send("Goto considered harmful");
});

function postMessage(name, text) {
    var botResponse, options, body, botReq;
    console.log("Current text is: " + text);
    rt.process(new handlers.Message(name, text));

}

function postResponse(response) {
  var body = response.generateResponseJson();
  body["bot_id"] = botID;

  console.log("sending " + response.text + " to " + botID);
  if(response.imageUrl){
      console.log(" - with image " + response.imageUrl);
  }

  request({
      url: "https://api.groupme.com/v3/bots/post",
      method: "POST",
      body: JSON.stringify(body)
  }, function(error, response, body){
      if(!error){
          console.log('posted message ' + response);
      } else {
          console.log('error posting message '  + JSON.stringify(error));
      };
  });

}


exports.respond = respond;
