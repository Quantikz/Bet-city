import express from "express";
import { createServer } from "node:http";
import { Server } from "socket.io";

const app=express();
const httpServer=createServer(app);
const io=new Server(httpServer,{cors:{origin:"*",methods:["GET","POST"]}});
const players=new Map();
const matches=new Map();

app.get("/health",(_,res)=>res.json({ok:true,players:players.size,matches:matches.size}));

io.on("connection",socket=>{
  players.set(socket.id,{id:socket.id,x:0,y:0,z:5,rotation:0,name:`Player-${socket.id.slice(0,4)}`});
  socket.emit("world:init",{playerId:socket.id,players:[...players.values()]});
  socket.broadcast.emit("player:join",players.get(socket.id));

  socket.on("player:move",state=>{
    const p=players.get(socket.id); if(!p)return;
    p.x=Number(state.x)||0;p.y=Number(state.y)||0;p.z=Number(state.z)||0;p.rotation=Number(state.rotation)||0;
    socket.broadcast.emit("player:move",p);
  });

  socket.on("duel:challenge",({opponentId,stake})=>{
    if(!players.has(opponentId)||!Number.isFinite(Number(stake)))return;
    const id=`m_${Date.now()}_${socket.id.slice(0,4)}`;
    matches.set(id,{id,host:socket.id,guest:opponentId,stake:Number(stake),status:"pending"});
    io.to(opponentId).emit("duel:challenge",{matchId:id,from:players.get(socket.id),stake:Number(stake)});
  });

  socket.on("duel:accept",({matchId})=>{
    const match=matches.get(matchId);if(!match||match.guest!==socket.id)return;
    match.status="active";match.turn=match.host;
    io.to(match.host).emit("duel:start",match);io.to(match.guest).emit("duel:start",match);
  });

  socket.on("duel:throw",({matchId,score})=>{
    const match=matches.get(matchId);if(!match||match.status!=="active"||match.turn!==socket.id)return;
    const n=Math.max(0,Math.min(60,Math.floor(Number(score)||0)));
    match.lastThrow={playerId:socket.id,score:n};
    match.turn=socket.id===match.host?match.guest:match.host;
    io.to(match.host).emit("duel:throw",match.lastThrow);io.to(match.guest).emit("duel:throw",match.lastThrow);
  });

  socket.on("duel:settle",({matchId,winnerId})=>{
    const match=matches.get(matchId);if(!match)return;
    match.status="settled";match.winnerId=winnerId;
    io.to(match.host).emit("duel:settled",match);io.to(match.guest).emit("duel:settled",match);
    matches.delete(matchId);
  });

  socket.on("disconnect",()=>{
    players.delete(socket.id);
    socket.broadcast.emit("player:leave",{id:socket.id});
  });
});

const port=Number(process.env.PORT||3001);
httpServer.listen(port,()=>console.log(`Bet City realtime server listening on :${port}`));
