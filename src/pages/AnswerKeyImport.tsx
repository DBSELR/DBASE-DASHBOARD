
import React, { useState } from "react";
import axios from "axios";
import { API_BASE } from "../config";
const AnswerKeyImport = () => {
const [file, setFile] = useState<any>(null);
const uploadFile = async () => {
if (!file) {
alert("Select file");
return;
}
const formData = new FormData();
formData.append("file", file);
const response = await axios.post(
`${API_BASE}OMRImport/ImportAnswerKey`,
formData,
{
headers: {
"Content-Type": "multipart/form-data"
}
}
);
alert(response.data.message);
};
return (
<div style={{ padding: 20 }}>
<h2>Import Answer Key</h2>
<input
type="file"
accept=".xlsx"
onChange={(e: any) =>
setFile(e.target.files[0])
}
/>

<br /><br />
<button onClick={uploadFile}>
Upload
</button>
</div>
);
};
export default AnswerKeyImport;