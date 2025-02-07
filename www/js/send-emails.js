async function sendEmail(event) {
    event.preventDefault();
    const backendHost = 'https://n54lm5igkl.execute-api.ap-southeast-2.amazonaws.com/dev';
    //const backendHost = 'https://localhost:8080';
    const formData = new FormData(document.getElementById("emailForm"));

    const file = formData.get("attachment");
    let attachmentBase64 = "";
    
    if (file && file.size > 0) {
        const reader = new FileReader();
        reader.readAsDataURL(file);
        attachmentBase64 = await new Promise(resolve => {
            reader.onload = () => resolve(reader.result.split(",")[1]);
        });
    }
    
    const payload = {
        recipient: formData.get("recipient"),
        subject: formData.get("subject"),
        body: formData.get("body"),
        body_type: formData.get("body_type"),
        attachment: attachmentBase64,
        attachment_name: file ? file.name : "",
        attachment_type: file ? file.type : ""
    };
    
    const response = await fetch(`${backendHost}/send-email`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
    });
    
    const result = await response.json();
    alert(result.message || result.error);
}
