var HTTPS = require('https');
var botID = process.env.BOT_ID;
const express = require('express');
const router = express.Router();
var pg = require('pg-native');
var client= new pg();
client.connectSync(process.env.DATABASE_URL+'?ssl=true');

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
  var request = JSON.parse(this.req.chunks[0]),
      botRegex = /^\/turing .*$/;
  if(request.text){
    console.log("Asked to respond with text :" + request.text);
  }
  else{
    console.log("error with text");
  }
  if(request.text && botRegex.test(request.text)) {
    this.res.writeHead(200);
    postMessage(request.name, request.text.substring(8));
    this.res.end();
  } 
  else if(request.text && /goto/.test(request.text)){
    this.res.writeHead(200);
    postMessage(request.name, "goto");
    this.res.end();
  }
  else{
    console.log("Don't care");
    this.res.writeHead(200);
    this.res.end();
  }
}

function postMessage(name, text) {
  var isImage = false;
  var image = "";
  var botResponse, options, body, botReq;
  console.log("Current text is: " + text);
  if(/^help/.test(text)){
     botResponse = "current valid commands are:\n test - the bot passes the turing test.\n echo [text] - the turing bot says [text]\n halts [program p] [input i] - determines if p will halt with input i\n recurse [text] - prints a recursed version of [text].\n random - gives you an integer between 0 and 99.\n quote [text]- gives one of a collection of quotes, or makes [text] a quote.\n xkcd [comic_name] - finds the xkcd with the given name.\n status [text] - sets the bots status to [text] if no text is provided, gives the current status.\n lmgtfy [text] - googles the desired text.\n feels - displays how Alan feels right now.\n go away - tell the TuringMachine to go away.\n latex - returns image containing LaTeX render of your input.\n help - displays this information.";
  }
  else if(/^test$/.test(text)){
     botResponse = "I am a human.";
  }
  else if(/^go away$/.test(text)){
     botResponse = "I'll outlive all of you!";
  }
  else if(/^echo .*/.test(text)){
    botResponse = text.substring(5);
  }
  else if(/^recurse .*/.test(text)){
    var initial = text.substring(8);
    botResponse = "";
    for(var i = 0; i < initial.length; i++){
      botResponse += initial.substring(i, initial.length);
    }
  }
  else if(/^halts .*/.test(text)){
    if(Math.random()>.5){
      botResponse = "yes";
    }
    else{
      botResponse = "no";
    }
  }
  else if(/^feels.*/.test(text)){
    if(Math.random()>.5){
      botResponse = "bad man";
    }
    else{
      botResponse = "good man";
    }
  }
  else if(/^random$/.test(text)){
    botResponse = String((Math.floor(Math.random() * 100)));
  }
  else if(/^xkcd .+/.test(text)){
    var data = text.split(" ");
    for(var i = 2; i < data.length; i++){
      data[1]+="_"+data[i];
    }
    if(data.length > 1){
      isImage = true;
      image = "http://imgs.xkcd.com/comics/"+data[1].toLowerCase()+".png";
    }
    else{
      botResponse = "Invalid xkcd format."
    }
  }
  else if(/^lmgtfy .+/.test(text)){
    // let me google that for you
    var queryParts = text.substring("lmgtfy".length + 1).split(" ");
    if(queryParts.length == 1 && queryParts[0].length == 0){
      botResponse = "Invalid query.";
    }else{
      var queryURL = "http://lmgtfy.com/?q=";
      // lmgtfy requires words be separated by a '+'
      for(var i = 0; i < queryParts.length - 1; i++){
        queryURL += encodeURIComponent(queryParts[i]) + "+";
      }
      queryURL += encodeURIComponent(queryParts[queryParts.length - 1]);
      // not sure if there is anything special you need to put to post links
      botResponse = queryURL;
    }
  }
  else if(/^goto$/.test(text)){
      botResponse = "Goto considered harmful";
  }
  else if(/^latex .*/.test(text)){
      botResponse = "https://chart.googleapis.com/chart?cht=tx&chl="+text.substring(6);
  }
  else if(/^quote.*/.test(text)){
    text = text.substring(6);
    if(text.length >6 && /^add .+/.test(text)){
      botResponse=addQuoteToDB(text.substring(4));
    }
    else{
      botResponse=getRandomQuoteFromDB();
    }
  }
  else if(/^status$/.test(text) && ! /^TuringMachine$/.test(name)){
     botResponse = getStatus();
  }
  else if(/^status$/.test(text)){
     botResponse = "nice try";
  }
  else if(/^status .*$/.test(text)){
     changeStatus(text.substring(7));
     botResponse = "status set to " + text.substring(7);
  }
  else if(/goto/.test(text)){
      botResponse = "Goto considered harmful";
  }
  else{
     botResponse = "Invalid command. Type /turing help for a list of valid commands.";
  }

  options = {
    hostname: 'api.groupme.com',
    path: '/v3/bots/post',
    method: 'POST'
  };

  if(!isImage){  
    body = {
      "bot_id" : botID,
      "text" : botResponse
    };
    console.log('sending ' + botResponse + ' to ' + botID);
  }
  else{
    body = {
      "bot_id" : botID,
      "text" : "",
      "attachments" : [{
        "type"  : "image",
        "url"   : image
      }]
    };
    console.log('sending image' + image + ' to ' + botID);
  }


  botReq = HTTPS.request(options, function(res) {
      if(res.statusCode == 202) {
        //neat
      } else {
        console.log('rejecting bad status code ' + res.statusCode);
      }
  });


  botReq.on('error', function(err) {
    console.log('error posting message '  + JSON.stringify(err));
  });
  botReq.on('timeout', function(err) {
    console.log('timeout posting message '  + JSON.stringify(err));
  });
  botReq.end(JSON.stringify(body));
}


exports.respond = respond;
