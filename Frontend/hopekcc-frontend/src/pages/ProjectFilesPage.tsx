import { useParams } from "react-router-dom";
import { useQuery } from "react-query";
import axios from "axios";

const ProjectFilesPage = () => {
  const { name } = useParams(); // Get the project name from the URL

  // Replace with your static root directory
  const rootDirectory = "C:/Users/uclam/Downloads/Lucas";

  // Fetch the files for the selected project using the project name
  const fetchProjectFiles = async () => {
    const directoryPath = `${rootDirectory}/${name}`;
    const response = await axios.get(
      `http://127.0.0.1:8000/api/projects/list_dynamic/?directory=${directoryPath}`
    );
    return response.data;
  };

  const { data, isLoading, isError } = useQuery(["projectFiles", name], fetchProjectFiles);

  if (isLoading) return <div>Loading files...</div>;
  if (isError) return <div>Error loading files.</div>;

  return (
    <div>
      <h2>Files for Project {name}</h2>
      <ul>
        {data.map((file: any, index: number) => (
          <li key={index}>
            {file.is_directory ? <b>{file.name}/</b> : file.name}
          </li>
        ))}
      </ul>
    </div>
  );
};

export default ProjectFilesPage;