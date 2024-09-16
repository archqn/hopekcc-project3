import { useParams } from "react-router-dom";
import { useQuery } from "react-query";
import axios from "axios";

const ProjectFilesPage = () => {
  const { name } = useParams();

  // Replace with your static root directory
  const rootDirectory = "C:/Users/uclam/Downloads/Lucas";

  // Fetch the files for the selected project using the project name
  const fetchProjectFiles = async () => {
    const directoryPath = `${rootDirectory}/${name}`;
    const response = await axios.get(
      `http://127.0.0.1:8000/api/projects/list_dynamic/?directory=${directoryPath}` // change later
    );
    return response.data;
  };

  const { data, isLoading, isError } = useQuery(["projectFiles", name], fetchProjectFiles);

  
  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]; // Only handle the first file for now
    if (!file) return;


    if (!name) {
      console.error("Project name is undefined.");
      return;
    }

    // Create FormData and append the single file
    const formData = new FormData();
    formData.append("file", file);
    formData.append("project", name);


    // Send the request to the backend
    try {
      const response = await axios.post(
        "http://127.0.0.1:8000/api/projects/upload/",
        formData,
        { headers: { "Content-Type": "multipart/form-data" } }
      );
      console.log("File uploaded successfully:", response.data);
    } catch (error) {
      console.error("Error uploading file:", error);
    }
  };

  const handleFolderUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    console.log("Folder upload triggered");
    const files = event.target.files;
    if (!files) return;

    console.log("Selected files:", files);

    if (!name) {
      console.error("Project name is undefined.");
      return;
    }

    // Create FormData and append the folder files
    const formData = new FormData();
    for (const file of Array.from(files)) {
      console.log("File path:", file.webkitRelativePath);
      formData.append("files", file);
      formData.append("paths", file.webkitRelativePath);
    }

    formData.append("project", name);

    // for (let pair of formData.entries()) {
    //   console.log(pair[0], pair[1]);
    // }

    // Send the request to the backend
    try {
      const response = await axios.post(
        "http://127.0.0.1:8000/api/projects/upload_folder/",
        formData,
        { headers: { "Content-Type": "multipart/form-data" } }
      );
      console.log("Folder uploaded successfully:", response.data);
      window.location.reload();
    } catch (error) {
      console.error("Error uploading folder:", error);
    }

  };

  if (isLoading) return <div>Loading files...</div>;
  if (isError) return <div>Error loading files.</div>;

  return (
    <div className="max-w-4xl mx-auto mt-4 p-6 bg-gray-200 rounded-lg shadow-md">
      <h2 className="text-2xl font-semibold text-gray-800 mb-4">{name} Contents</h2>
      <button className="bg-[#1d769f] hover:bg-blue-600 text-white font-semibold py-2 px-4 rounded mb-4">Deploy</button>
      <ul className="space-y-2 mb-4">
        {data.map((file: any, index: number) => (
          <li key={index}>
            {file.is_directory ? <b>{file.name}/</b> : file.name}
          </li>
        ))}
      </ul>
      {/*}
      <label htmlFor="file-upload" className="upload-file-label">
        Upload File
        <input
          id="file-upload"
          type="file"
          onChange={handleFileUpload}
        />
      </label>
      */}
      <label htmlFor="folder-upload" className="bg-[#1d769f] hover:bg-blue-600 text-white font-semibold py-2 px-4 rounded inline-block cursor-pointer">
        Upload Folder
        <input
          id ="folder-upload"
          type="file"
          {...({ webkitdirectory: "true" } as any)}
          multiple
          onChange={handleFolderUpload}
          style={{ display: "none" }}
        />
      </label>
    </div>
  );
};

export default ProjectFilesPage;