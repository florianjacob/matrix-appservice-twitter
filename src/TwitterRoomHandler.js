/*
  Hander for the many different types of rooms this AS will support.
  Types are as follows (which are tracked in 'twitter_type' in the remote rooms):
  'timeline' -  A room that tracks a singular users activities
  'service' -   A room that can link/unlink twitter accounts from users and
                provide general assistance.

*/
var log = require('npmlog');


/**
 * TwitterRoomHandler - The handler class to delegate which handler should Deal
 * with which request.
 * @class
 * @param  {matrix-appservice-bridge.Bridge} bridge
 * @param  {Object.<string,TwitterHandler>} handlers Handers to register for
 * each type of room.
 */
var TwitterRoomHandler = function (bridge, handlers) {
  this._bridge = bridge;
  this.handlers = handlers; // 'service' handler
}

TwitterRoomHandler.prototype.processInvite = function (event, request, context) {
  var remote = context.rooms.remote;
  var twitbot = "@twitbot:"+this._bridge.opts.domain;
  if(remote == null
     && event.sender != twitbot
     && event.state_key == twitbot)
  {
    //Services bot
    this.handlers.services.processInvite(event, request, context);
    return;
  }
}

TwitterRoomHandler.prototype.processLeave = function (event, request, context) {
  var remote = context.rooms.remote;
  if(remote == null) {
    return;
  }
  var type = remote.data.twitter_type;

  if(type == "service") {
    this.handlers.services.processLeave(event, request, context);
  }
  else if(type == "user_timeline") {
    this.handlers.timeline.processLeave(event, request, context)
  }
}

TwitterRoomHandler.prototype.passEvent = function (request, context) {
  var event = request.getData();
  var remote = context.rooms.remote;
  if (event.type == "m.room.member") {
    if(event.membership == "invite") {
      this.processInvite(event, request, context);
    }
    else if(event.membership == "leave") {
      this.processLeave(event, request, context);
    }
  }
  else if(remote) {
    if(event.type == "m.room.message") {
      if(remote.data.twitter_type == "service") {
        this.handlers.services.processMessage(event, request, context);
      }
      else if(remote.data.twitter_type == "timeline") {
        this.handlers.timeline.processMessage(event, request, context);
      }
      else if(remote.data.twitter_type == "hashtag") {
        this.handlers.hashtag.processMessage(event, request, context);
      }
      else if(remote.data.twitter_type == "dm") {
        this.handlers.directmessage.processMessage(event, request, context);
      }
      else if(remote.data.twitter_type == "user_timeline") {
        if(remote.data.twitter_owner == event.sender) {
          this.handlers.timeline.processMessage(event, request, context);
        }
      }
      return;
    }

  }
  log.info("RoomHandler", "Got message from a non-registered room.");
}

TwitterRoomHandler.prototype.processAliasQuery = function (alias, aliasLocalpart) {
  var type = aliasLocalpart.substr("twitter_".length, 2);
  var part = aliasLocalpart.substr("twitter_.".length);

  if(type[0] == '@') { //User timeline
    return this.handlers.timeline.processAliasQuery(part);
  }
  else if(type[0] == '#') { //Hashtag
    return this.handlers.hashtag.processAliasQuery(part);
  }
  /*else if(type == 'DM') {
    return this.handlers.directmessage.processAliasQuery(part.substr(1));
  }*/
  else {
    //Unknown
    return null;
  }
}

TwitterRoomHandler.prototype.onRoomCreated = function (alias, roomId) {
  var roomstore = this._bridge.getRoomStore();
  roomstore.getEntriesByMatrixId(roomId).then(entries =>{
    if(entries.length == 0) {
      log.error("RoomHandler", "Got a onRoomCreated, but no remote is associated.");
      return;
    }
    var type = entries[0].remote.data.twitter_type
    if(type == "timeline") {
      this.handlers.timeline.onRoomCreated(alias, entries[0]);
    }
    else if(type == "hashtag") {
      this.handlers.hashtag.onRoomCreated(alias, entries[0]);
    }
  });
}

module.exports = {
  TwitterRoomHandler: TwitterRoomHandler
}
