const guildSelect = document.getElementById('guildSelect');
const channelSelect = document.getElementById('channelSelect');
const messageBox = document.getElementById('messageBox');
const suggestionBox = document.getElementById('mentionSuggestions');
const fileInput = document.getElementById('fileInput');
const embedTitle = document.getElementById('embedTitle');
const embedDesc = document.getElementById('embedDesc');
const embedFooter = document.getElementById('embedFooter');
const embedColor = document.getElementById('embedColor');

let members=[],roles=[];

async function loadGuilds(){
  const res = await fetch('/api/guilds');
  const guilds = await res.json();
  guildSelect.innerHTML="<option value=''>--Select--</option>";
  guilds.forEach(g=>guildSelect.innerHTML+=`<option value="${g.id}">${g.name}</option>`);
}
loadGuilds();

guildSelect.addEventListener('change', async ()=>{
  const guildId = guildSelect.value;
  if(!guildId) return;
  // channels
  const resCh = await fetch(`/api/channels/${guildId}`);
  const channels = await resCh.json();
  channelSelect.innerHTML="";
  channels.forEach(c=>channelSelect.innerHTML+=`<option value="${c.id}"># ${c.name}</option>`);
  // members & roles
  const memRes = await fetch(`/api/members/${guildId}`);
  members = await memRes.json();
  const roleRes = await fetch(`/api/roles/${guildId}`);
  roles = await roleRes.json();
});

// --- Send Message ---
document.getElementById('sendBtn').addEventListener('click', async ()=>{
  const channelId = channelSelect.value;
  const content = messageBox.value;
  if(!channelId||!content) return alert("Select channel & type message");
  await fetch('/send',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({channelId,content})});
  alert("Message sent!"); messageBox.value="";
});

// --- Send Embed ---
document.getElementById('sendEmbedBtn').addEventListener('click', async ()=>{
  const channelId = channelSelect.value;
  if(!channelId) return alert("Select channel");
  const colorVal = embedColor.value||"#6366f1";
  await fetch('/sendEmbed',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({
    channelId,
    title:embedTitle.value,
    description:embedDesc.value,
    footer:embedFooter.value,
    color:colorVal
  })});
  alert("Embed sent!");
});

// --- Send File ---
document.getElementById('sendFileBtn').addEventListener('click', async ()=>{
  const channelId = channelSelect.value;
  if(!channelId||!fileInput.files.length) return alert("Select channel & file");
  const formData = new FormData();
  formData.append('file', fileInput.files[0]);
  formData.append('channelId', channelId);
  await fetch('/sendFile',{method:'POST',body:formData});
  alert("File sent!"); fileInput.value='';
});

// --- Clear Channel ---
document.getElementById('clearBtn').addEventListener('click', async ()=>{
  const channelId = channelSelect.value;
  if(!channelId) return alert("Select channel");
  if(!confirm("Delete all messages (max 14 days)?")) return;
  await fetch(`/deleteAll/${channelId}`,{method:'POST'});
  alert("All messages cleared!");
});

// --- Autocomplete Mentions ---
messageBox.addEventListener("input", ()=>{
  const value = messageBox.value;
  const atIndex = value.lastIndexOf("@");
  if(atIndex === -1){ suggestionBox.innerHTML=""; return;}
  const query = value.slice(atIndex+1).toLowerCase();
  if(!query){suggestionBox.innerHTML=""; return;}
  const matches = members.filter(m=>m.username.toLowerCase().includes(query)).concat(roles.filter(r=>r.name.toLowerCase().includes(query)));
  suggestionBox.innerHTML="";
  matches.forEach(item=>{
    const div = document.createElement("div");
    div.classList.add("suggestionItem");
    div.textContent = item.username||item.name;
    div.addEventListener("click", ()=>{
      const mention = item.username? `<@${item.id}>` : `<@&${item.id}>`;
      messageBox.value = value.slice(0,atIndex) + mention + " ";
      suggestionBox.innerHTML="";
    });
    suggestionBox.appendChild(div);
  });
});