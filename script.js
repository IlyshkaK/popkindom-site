function copyIp() {
  const ip = document.getElementById("serverIp").innerText;

  navigator.clipboard.writeText(ip).then(() => {
    alert("IP сервера скопирован: " + ip);
  });
}