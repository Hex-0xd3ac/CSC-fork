// 当网络出现故障时，socket 可能卡在某个聊天室里，用户可以拿着这个命令踢自己出去。
export async function run(hazel, core, hold, socket, data) {
  // 先检查昵称
  //if (!core.verifyNickname(data.nick)) {
  //  core.replyWarn('NICKNAME_INVALID', '昵称应当仅由汉字、字母、数字和不超过 3 个的特殊字符（_-+.:;）组成，而且不能太长。', socket);
  //  return;
  //}

  // 查找目标用户
  let targetSockets = core.findSocket({ channel: socket.channel, remoteAddress: socket.remoteAddress });
  
  // 如果目标用户不存在
  if (targetSockets.length < 1) {
    core.replyWarn('USER_NOT_FOUND', '在这个聊天室找不到您指定的用户。', socket);
    return;
  }

  targetSockets = targetSockets.filter(targetSocket => targetSocket.connectionID !== socket.connectionID);
  
  core.replyInfo('KICKED_INFO', '共有 ' + targetSockets.length + ' 个目标。', socket, { nick: socket.nick });
  
  targetSockets.forEach(targetSocket => {
    if (targetSocket.remoteAddress === socket.remoteAddress) {
      core.replyInfo('KICKED_BY_SELF', '您已经被您自己断开连接，如果不是您自己执行的操作，请重新加入并通知管理员。', targetSocket);
      core.replyInfo('KICKED', '已将 ' + targetSocket.nick + ' 断开连接。', socket, { nick: socket.nick });
      targetSocket.close();
    }
    else {
      core.replyWarn('KICKME_FAILED', '您指定的用户可能不是您自己。', socket);
    }
  });

  // 如果目标用户是的 IP 或者 tripcode 与自己相同
  //if ((() => {
  // if (targetSocket.remoteAddress === socket.remoteAddress) { return true; }
  //  if (typeof targetSocket.trip == 'string' && typeof socket.trip == 'string') {
  //    if ((socket.trip === targetSocket.trip) && socket.trip.length === 6) { return true; }
  //  }
  //  return false;
  // })()) {
    // 踢自己出去
  //  core.replyInfo('KICKED_BY_SELF', '您已经被您自己断开连接，如果不是您自己执行的操作，请重新加入并通知管理员。', targetSocket);
  //  core.replyInfo('KICKED', '已将 ' + targetSocket.nick + ' 断开连接。', socket, { nick: socket.nick });
  //  targetSocket.terminate();
  //} else {
  //  core.replyWarn('KICKME_FAILED', '您指定的用户可能不是您自己。', socket);
  //}

  // 写入存档
  targetSockets.forEach(targetSocket => {
    core.archive('KME', socket, targetSocket.nick);
  });
}

// 用户通过 /kickme nick 的方式执行命令
export async function execByChat(hazel, core, hold, socket, line) {
  //let targetNick = line.slice(8).trim();

  // 验证输入的昵称
  //if (!core.verifyNickname(targetNick)) {
  //  core.replyMalformedCommand(socket);
  //  return;
  //}
  // 执行命令
  await run(hazel, core, hold, socket);
}

export const name = 'kickme';
export const requiredLevel = 1;
export const requiredData = ['nick'];
export const moduleType = 'ws-command';
