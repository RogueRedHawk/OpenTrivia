let socket = io({
  transports: ['websocket']
});
let status = 0; // 0 = offline,
let lastConnected = 0; 
let user = false; 

let multiSelect = true; 
let qType = ''; 

let snkTimeout = false, snkType = 1; 
/**
 * Shows a temporary snackbar on the user's screen. 
 * @param {string} msg 
 * @param {boolean} [small=false] 
 */
function showSnackbar(msg, small){
  let target = small?$('#snackbar-sm'):$('#snackbar'); 
  let type = small?1:0; 
  if (snkTimeout) {
    clearTimeout(snkTimeout); 
    if (type !== snkType) {
      // hide existing snackbars
      $('.snackbar').css({'bottom': '-40px', 'opacity': '0'}); 
    } else {
      // emphasize existing snackbar
      snkTimeout = false; 
      target.addClass('pulse');
      setTimeout(() => {
        target.removeClass('pulse');
      }, 400) 
    }
  }
  target.html(msg); 
  target.css({'bottom': '40px', 'opacity': '1'}); 
  snkType = type; 
  snkTimeout = setTimeout(() => {
    target.css({'bottom': '-40px', 'opacity': '0'}); 
    snkTimeout = false;
  }, 2100); 
}

function showStatus(type, msg){
  let map = {
    'error': ['fa-exclamation-triangle', 'st-red'], 
    'pending': ['fa-circle-notch fa-spin', 'st-yellow'], 
    'success': ['fa-wifi', 'st-green']
  }
  $('#status').html(`<i class='fas ${map[type][0]}'></i> ${msg}`); 
}

function checkSA(a, b){
  let ans = a.toLowerCase().trim(); 
  let cor = b.toLowerCase().trim(); 
  let lev = new Levenshtein(ans, cor).distance; 
  if(ans.slice(0, 1) !== cor.slice(0, 1)){
    return false; 
  } else if(lev < 3  || lev === 3 && cor.length > 11){
    return true; 
  } else{
    return false; 
  }
}

function resetMC(){
  $('.btn-mc').prop('disabled', false);
  $('.btn-mc.correct').removeClass('correct'); 
  $('.btn-mc.incorrect').removeClass('incorrect');  
  $('.btn-mc.selected').removeClass('selected'); 
  $('.btn-mc.pending').removeClass('pending'); 
  $('.btn-mc').forEach((e) => {
    $(e).children('b').text(e.id.slice(4).toUpperCase()); // reset letters
  })
}

function resetSA(){
  $('#i-sa').prop('disabled', false);
  $('#i-sa').prop('placeholder', 'Type here...'); 
  $('#i-sa').removeClass('correct').removeClass('incorrect');
}

function showScores(){
  $('#scores-overlay').show().addClass('scores-show'); 
  setTimeout(() => {
    $('#scores-overlay').removeClass('scores-show'); 
  }, 600); 
}

function hideScores(){
  $('#scores-overlay').addClass('scores-hide'); 
  setTimeout(() => {
    $('#scores-overlay').hide().removeClass('scores-hide'); 
  }, 600); 
}

$('.btn-mc').forEach((e) => {
  $(e).on('click', () => {
    resetMC(); 
    let target = e;  
    $(target).addClass('pending');
    if(multiSelect){
      $(target).prop('disabled', true)}
    else{
      $('.btn-mc').prop('disabled', true)}
    $(target).children('b').html(`<i class='fas fa-circle-notch fa-spin' style='font-size: 20px'></i>`); 
    logger.info(`submitted "${target.id.slice(4)}" as answer`);
    socket.emit('answer', target.id.slice(4)); 
  })
})

$('#i-sa').on('keyup', (e) => {
  if(e.key === 'Enter'){
    logger.info(`submitted "${$('#i-sa').val()}" as answer`)
    // $('#sa-recent').show(); 
    // $('#sa-rec-val').text($('#i-sa').val());
    $('#i-sa').prop('placeholder', $('#i-sa').val());
    socket.emit('answer', $('#i-sa').val()); 
    $('#i-sa').val('');
  }
})

socket.on('connect', () => {
  logger.info('socket connected; id: '+socket.id)
  if(!user){
    logger.info('first connection, attempting to retrieve team info')
    socket.emit('status'); 
    showStatus('pending', 'Authenticating...'); 
    return; 
  } else if (Date.now() - lastConnected > 500) {
    // check if question has since changed
    socket.emit('status', 1); 
  }
  showStatus('success', 'Connected'); 
  ping(); 
});

socket.on('disconnect', (reason) => {
  logger.info('socket disconnected: '+reason); 
  if(reason === 'io server disconnect'){
    showStatus('error', 'Kicked by Server'); 
    alert('Disconnected by server. ')
  } else {
    $('#s-ping-outer').hide(); 
    lastConnected = Date.now(); 
    showStatus('pending', 'Reconnecting...'); 
  }
})

socket.on('reconnect_attempt', () => {
  // showSnackbar('Reconnecting...');
  // socket.io.opts.transports = ['polling', 'websocket']; // attempt to use xhr failsafe
});

socket.on('connect_error', (error) => {
  if(error.message === 'authentication error'){
    window.open('..', '_self')
  }
  logger.error(error); 
});

socket.on('status', (res) => {
  if(res.valid){
    showStatus('success', 'Connected'); 
    logger.info('recieved data: '+JSON.stringify(res.user))
    user = res.user; 
    $('#s-team').text(user.TeamName); 
    $('#s-school').text(`${user.TeamID} • ${user.School}`)
  }
  else{
    showStatus('error', 'Not Authenticated'); 
    logger.warn('login rejected; redirecting');
    setTimeout(() => {
      window.open('..', '_self')
    }, 1000); 
  }
}); 

socket.on('question', (data) => {
  logger.info('recieved question: '+JSON.stringify(data));
  $('.q').hide(); 
  $('#q-timer').css('background', ''); 
  qType = data.type; 
  if(data.num){
    $('#q-num').show(); 
    $('#q-num').text('Question ' + data.num); 
  }
  switch(data.type){
    case 'mc': 
      resetMC();
      $('.q-ind').css('opacity', 0).show(); // timer indicator
      $('#q-mc').show(); 
      for(let i = 0; i < data.options.length; i++){
        $('#mc-' + (i+1)).text(data.options[i]); 
        // $('#btn-' + (i+1)).prop('title', data.options[i]); 
      }
      break; 
    case 'sa': 
    case 'bz': 
      resetSA(); 
      $('.q-ind').css('opacity', 0).show(); // timer indicator
      $('#q-sa').show(); 
      $('#i-sa').prop('disabled', false); 
      $('#i-sa').val('');
      break; 
    case 'sp': 
      $('#q-sp').show(); 
      $('#a-sp').prop('href', data.url); 
      break; 
    case 'md': 
      $('#q-md').show(); 
      $('#btn-r').prop('disabled', false).removeClass('selected correct').html(`<b><i class='far fa-check-circle'></i></b> My team's ready!`);
  }
  if(!data.active){
    $('#q-num').hide(); 
    $('#q-stop').show(); 
    $('.btn-mc').prop('disabled', true); 
    $('#i-sa').prop('disabled', true); 
  }
})

socket.on('announcement', (data) => {
  logger.info('recieved announcement: '+JSON.stringify(data));
  $('.q').hide(); 
  $('#q-timer').css('background', ''); 

  $('#q-msg h1').text(data.title); 
  $('#q-msg p').text(data.body); 
  $('#q-msg').show(); 
})

socket.on('scores-release', () => {
  logger.info('received score release message'); 
  $("#scores-iframe")[0].contentDocument.location.reload(); 
  $('.q').hide(); 
  $('#q-timer').css('background', ''); 

  $('#q-scores').show(); 
})

socket.on('answer', (ans) => {
  logger.info('recieved question answer: '+ans); 
  if(qType === 'mc'){
    let sel = $('.selected')[0].id.slice(4); 
    if(sel === ans){
      $('.selected').addClass('correct');
      $('.selected').children('b').html(`<i class='fas fa-check'></i>`); 
    } else{
      $('.selected').addClass('incorrect'); 
      $('.selected').children('b').html(`<i class='fas fa-times'></i>`); 
      if ($('#btn-'+ans)[0]) {
        $('#btn-'+ans).children('b').html(`<i class='fas fa-check'></i>`); 
      }
    }
  } else if(qType === 'sa' || qType === 'bz'){
    $('#i-sa').prop('disabled', true); 
    $('#i-sa').val($('#i-sa').prop('placeholder')); 
    if($('#sa-right-timed').css('display') === 'block' || $('#sa-right').css('display') === 'block' || checkSA(ans, $('#i-sa').prop('placeholder'))){
      $('#i-sa').addClass('correct'); 
      $('#sa-right-timed').hide(); 
      $('#sa-right').show(); 
    } else{
      $('#i-sa').addClass('incorrect');
      $('#sa-wrong-timed').hide(); 
      $('#sa-wrong').show(); 
    }
  }
})

socket.on('answer-ack', (ack) => {
  logger.info('recieved answer ack: '+JSON.stringify(ack)); 
  if(ack.ok){
    if(qType === 'mc') {
      resetMC(); 
      $(`#btn-${ack.selected}`).prop('disabled', true).addClass('selected'); 
    } else if (qType === 'md') {
      $(`#btn-r`).prop('disabled', true).addClass('selected correct').children('b').html(`<i class='fas fa-check'></i>`); 
    }
    if (ack.sender) {
      showSnackbar('Answer Submitted!');
    } else {
      if (ack.senderName) {
        showSnackbar(`${ack.senderName} submitted an answer!`, 1); 
      } else {
        showSnackbar(`A teammate submitted an answer!`, 1); 
      }
    }
  } else{
    alert(ack.msg); 
  }
})

socket.on('answer-time', (inp) => {
  logger.info('recieved answer ack (timed): '+JSON.stringify(inp)); 
  if(inp.correct){
    if (inp.time) {
      $('#sa-time').text(inp.time/1000 + 's');
    } else {
      $('#sa-time').text('n/a');
    }
    $('#i-sa')[0].blur(); 
    $('#i-sa').val(inp.answer).addClass('correct').prop('disabled', true); 
    $('#sa-right-timed').show().addClass('pulse'); 
    $('#sa-wrong-timed').hide(); 
    setTimeout(() => {
      $('#sa-right-timed').removeClass('pulse');
    }, 600) 
    if (!inp.sender) {
      if (inp.senderName) {
        showSnackbar(`${inp.senderName} got the answer!`, 1); 
      } else {
        showSnackbar(`A teammate got the answer!`, 1); 
      }
    }
  } else{
    if (inp.message) {
      $('#q-sa-incorrect-msg').text(inp.message);
    } else {
      $('#q-sa-incorrect-msg').text('try again');
    }
    $('#sa-wrong-timed').show(); 
    $('#sa-wrong-timed').addClass('pulse'); 
    $('#sa-right-timed').hide(); 
    setTimeout(() => {
      $('#sa-wrong-timed').removeClass('pulse');
    }, 600)
  }
})

socket.on('answer-buzzer', (inp) => {
  logger.info('recieved answer ack (buzzer): '+JSON.stringify(inp)); 
  $('#sa-buzzer-msg').text(inp.message); 
  $('#sa-buzzer-points').text(inp.points); 
  $('#sa-buzzer').css('display', 'inline-block');
})

socket.on('stop', () => {
  $('#q-num').hide(); 
  $('#q-timer').hide(); 
  $('#q-stop').show(); 
  $('.btn-mc').prop('disabled', true); 
  $('#i-sa').prop('disabled', true); 
})

let ping_ds = 0; 
function ping() {
  if (socket && socket.connected) {
    ping_ds = Date.now(); 
    socket.volatile.emit('tn-ping'); 
  }
}
socket.on('pong', () => {
  $('#s-ping-outer').show(); 
  $('#s-ping').text(Date.now() - ping_ds); 
})
setInterval(ping, 4000); 
socket.connect(); 
ping(); 

// Timer functionality
socket.on('timer', (v) => {
  if (v === -1) {
    $('#q-timer').css({'opacity': 1, 'background': `#0000a07f`}); 
    $('#q-timer').html(`<i class='fas fa-stopwatch'></i> Timer paused.`);
    return; 
  }
  $('#q-timer').css({'opacity': 1, 'background': `#${v>10?'00':(250 - v*25).toString(16).padStart(2, 0)}00007f`}); 
  $('#q-timer').html(`<i class='fas fa-stopwatch'></i> <b>${v} second${v!=1?'s':''}</b> remaining.`);
}); 

socket.on('config-bk', (i) => {
  $('#bk').css('background-image', `url(images/${i})`);
})

// socket.on('chat', function(msg){
//   console.log(msg);
//   $('#log').append($('<li>').text(msg));
// });

window.onblur = function() {
  socket.emit('ac-blur'); 
}

window.onfocus = function() {
  socket.emit('ac-focus'); 
}