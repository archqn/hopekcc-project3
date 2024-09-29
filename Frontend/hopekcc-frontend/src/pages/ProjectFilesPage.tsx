import { useState, useEffect } from "react";
import { useParams } from "react-router-dom";
import { useQuery } from "react-query";
import axios from "axios";
import { DeleteButton } from "../components/projectComponents/Buttons.tsx";
import { jwtDecode } from 'jwt-decode';

interface DecodedToken {
  email: string;
  name: string;
  picture: string;
}

const ProjectFilesPage = () => {
  const { name } = useParams();
  const [userDirectory, setUserDirectory] = useState<string>("");
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(false);
  const [authLoading, setAuthLoading] = useState<boolean>(true);
  const [userEmail, setUserEmail] = useState<string>("");
  useEffect(() => {
    const token = localStorage.getItem("google_token");
    if (token) {
      try {
        const decodedToken = jwtDecode<DecodedToken>(token);
        const email = decodedToken.email;

        // Format the email and set the dynamic directory
        const formattedEmail = `ext_${email.replace(/[@.]/g, "_")}`;


        // ------------------------------------ SET ROOT DIRECTORY HERE --------------------------------
        const rootDirectory = "home/";  


        setUserDirectory(`${rootDirectory}${formattedEmail}`);
	setUserEmail(`${email}`);
        setIsAuthenticated(true);
      } catch (error) {
        console.error("Error decoding token:", error);
        setIsAuthenticated(false);
      }
    }
    else {
      setIsAuthenticated(false);
    }
    setAuthLoading(false); 
  }, []);

  


  // Fetch the files for the selected project using the project name
  const fetchProjectFiles = async () => {
    if (!userDirectory || !name) return [];

    const directoryPath = `${userDirectory}/${name}`;
    const response = await axios.get(
      `https://class4.hopekcc.org/api/projects/list_dynamic/?directory=${directoryPath}/` 
    );
    return response.data;
  };

  const { data, isLoading, isError } = useQuery(["projectFiles", name, userDirectory], fetchProjectFiles, {
    enabled: !!name, 
  });

  const handleDeleteFolder = async (folderName: string) => {
    if (!window.confirm(`Are you sure you want to delete the folder: ${folderName}?`)) {
      return;
    }

    try {
      const response = await axios.post("https://class4.hopekcc.org/api/projects/delete_folder/", {
        project: name, 
        folder: folderName,  
        directory: userDirectory,
      });

      if (response.status === 200) {
        alert("Folder deleted successfully.");
       
	window.location.assign("https://class4.hopekcc.org/classroom/live/dist/");

      } else {
        console.error("Failed to delete folder:", response.data);
      }
    } catch (error) {
      console.error("Error deleting folder:", error);
      alert("Error deleting folder.");
    }
  };



  const handleDeploy = async () => {
    try {
      // Fetch the list of project files first to check for the 'main' subfolder
      const directoryPath = `${userDirectory}/${name}`;
      const filesResponse = await axios.get(
        `https://class4.hopekcc.org/api/projects/list_dynamic/?directory=${directoryPath}`
      );
  
      // Check if 'main' subfolder exists
      const hasMainFolder = filesResponse.data.some(
        (file: any) => file.is_directory && file.name === 'main'
      );
  
      if (!hasMainFolder) {
        alert("Deployment failed: A 'main' folder is required for deployment.");
        return; // Stop further execution if 'main' folder doesn't exist
      }

      const deployPath = `${directoryPath}/main`;
  
      // Proceed with deployment if 'main' folder exists
      const deployResponse = await axios.post(
        "https://class4.hopekcc.org/api/projects/deploy/",
        { path: deployPath, email: userEmail },
        { headers: { "Content-Type": "application/json" } }
      );

      const dynamicPort = deployResponse.data.port;
      console.log("Deployment Output:", deployResponse.data);


      // Redirect to the new URL with the dynamic port
      if (dynamicPort) {
        window.open(`http://class4.hopekcc.org:${dynamicPort}/`);
      } else {
        alert("Deployment successful, but no port number returned.");
      }









      console.log("Deployment Output:", deployResponse.data);
      alert("Deployment output: " + deployResponse.data.output);
    } catch (error) {
      console.error("Error deploying project:", error);
      alert("Deployment failed.");
    }
  };



  /*
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
  */

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
    formData.append("directory", userDirectory);

    // for (let pair of formData.entries()) {
    //   console.log(pair[0], pair[1]);
    // }

    // Send the request to the backend
    try {
      const response = await axios.post(
        "https://class4.hopekcc.org/api/projects/upload_folder/",
        formData,
        { headers: { "Content-Type": "multipart/form-data" } }
      );
      console.log("Folder uploaded successfully:", response.data);
      window.location.assign("https://class4.hopekcc.org/classroom/live/dist/");
    } catch (error) {
      console.error("Error uploading folder:", error);
    }

  };

  if (authLoading) {
    return (
      <div className="my-56">
        <div className="text-center">Loading authentication...</div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <div className="my-56">
        <div className="text-center">Please log in to view your projects.</div>
      </div>
    );
  }

  if (isLoading) return <div>Loading files...</div>;
  if (isError) return <div>Error loading files.</div>;


  return (
    <div className="max-w-4xl mx-auto mt-4 p-6 bg-gray-200 rounded-lg shadow-md">
      <h2 className="text-2xl font-semibold text-gray-800 mb-4">{name} Contents</h2>
      <button 
        className="bg-[#1d769f] hover:bg-blue-600 text-white font-semibold py-2 px-4 rounded mb-4"
        onClick={handleDeploy}
      >
        Deploy Flet
      </button>

      <button 
        className="bg-[#1d769f] hover:bg-blue-600 text-white font-semibold py-2 px-4 rounded"
        onClick={() => window.location.href = `https://class4.hopekcc.org/classroom/live/backend/${userDirectory}/${name}`}
      >
        View Files
      </button>





      <ul className="space-y-2 mb-4">
        {data.map((file: any, index: number) => (
          <li key={index}>
            {file.is_directory ? <b>{file.name}/</b> : file.name}
            {file.is_directory && (
              <DeleteButton
              onClick={() => handleDeleteFolder(file.name)} // Use DeleteButton here
              className="ml-2"
            />
          )}
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
