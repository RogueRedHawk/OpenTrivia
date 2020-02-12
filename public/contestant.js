let socket = io();
let status = 0; // 0 = offline,
let user = false; 

let multiSelect = true; 
let qType = ''; 

let snkTimeout; 
function showSnackbar(msg){
  clearTimeout(snkTimeout); 
  $('#snackbar').html(msg); 
  $('#snackbar').css({'bottom': '40px', 'opacity': '1'}); 
  snkTimeout = setTimeout(() => {
    $('#snackbar').css({'bottom': '-40px', 'opacity': '0'}); 
  }, 3000); 
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
}

function resetSA(){
  $('#i-sa').prop('disabled', false);
  $('#i-sa').prop('placeholder', 'Type here...'); 
  $('#i-sa').removeClass('correct').removeClass('incorrect');
}

$('.btn-mc').on('click', (e) => {
  resetMC(); 
  let targRaw = e.path; // chromium-based browser support
  if(!e.path && e.explicitOriginalTarget) targRaw = e.explicitOriginalTarget;  // firefox support
  let target = $(targRaw).filter('.btn-mc')[0]; 
  console.log(e); 
  $(target).addClass('selected');
  if(multiSelect){
    $(target).prop('disabled', true)}
  else{
    $('.btn-mc').prop('disabled', true)}
  logger.info(`submitted "${target.id.slice(4)}" as answer`)
  socket.emit('answer', target.id.slice(4)); 
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
  }
  showStatus('success', 'Connected'); 
});

socket.on('disconnect', (reason) => {
  logger.info('socket disconnected: '+reason); 
  if(reason === 'io server disconnect'){
    showStatus('error', 'Kicked by Server'); 
    alert('Disconnected by server. ')
  } else {
    showStatus('pending', 'Reconnecting...'); 
  }
})

socket.on('error', (error) => {
  if(error === 'Authentication error'){
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
  qType = data.type; 
  if(data.num){
    $('#q-num').show(); 
    $('#q-num').text('Question ' + data.num); 
  }
  switch(data.type){
    case 'mc': 
      resetMC();
      $('#q-mc').show(); 
      for(let i = 0; i < data.options.length; i++){
        $('#mc-' + (i+1)).text(data.options[i]); 
        // $('#btn-' + (i+1)).prop('title', data.options[i]); 
      }
      break; 
    case 'sa': 
      resetSA(); 
      $('#q-sa').show(); 
      $('#i-sa').prop('disabled', false); 
      $('#i-sa').val('');
      break; 
    case 'sp': 
      $('#q-sp').show(); 
      $('#a-sp').prop('href', data.url); 
      break; 
  }
})

socket.on('answer', (ans) => {
  logger.info('recieved question answer: '+ans); 
  if(qType === 'mc'){
    let sel = $('.selected')[0].id.slice(4); 
    if(sel === ans){
      $('.selected').addClass('correct');
    } else{
      $('.selected').addClass('incorrect'); 
    }
  } else if(qType === 'sa'){
    $('#i-sa').prop('disabled', true); 
    $('#i-sa').val($('#i-sa').prop('placeholder')); 
    if(checkSA(ans, $('#i-sa').prop('placeholder'))){
      $('#i-sa').addClass('correct'); 
      $('#sa-right').show(); 
    } else{
      $('#i-sa').addClass('incorrect');
      $('#sa-wrong').show(); 
    }
  }
})

socket.on('answer-ack', (ack) => {
  logger.info('recieved answer ack: '+JSON.stringify(ack)); 
  if(ack.ok){
    showSnackbar('Answer Submitted!');
  } else{
    alert(ack.msg); 
  }
})

socket.on('stop', () => {
  $('#q-num').hide(); 
  $('#q-stop').show(); 
  $('.btn-mc').prop('disabled', true); 
  $('#i-sa').prop('disabled', true); 
})

socket.on('pong', (latency) => {
  $('#s-ping-outer').show(); 
  $('#s-ping').text(latency); 
})

// socket.on('chat', function(msg){
//   console.log(msg);
//   $('#log').append($('<li>').text(msg));
// });