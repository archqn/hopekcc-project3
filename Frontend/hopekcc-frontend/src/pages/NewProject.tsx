import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "../components/projectComponents/Buttons";
import axios from "axios";
import { useMutation, useQueryClient } from "react-query";
import { jwtDecode } from 'jwt-decode';


interface InputFieldProps {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  required?: boolean;
}

interface DecodedToken {
  email: string;
  name: string;
  picture: string;
}

const InputField: React.FC<InputFieldProps> = ({
  id,
  label,
  value,
  onChange,
  required = false,
}) => (
  <div className="mb-4">
    <label htmlFor={id} className="block text-sm font-medium text-gray-700">
      {label}
    </label>
    <input
      type="text"
      id={id}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-300 focus:ring focus:ring-indigo-200 focus:ring-opacity-50"
      required={required}
    />
  </div>
);

interface TextAreaFieldProps extends InputFieldProps {
  rows?: number;
}

const TextAreaField: React.FC<TextAreaFieldProps> = ({
  id,
  label,
  value,
  onChange,
  rows = 3,
}) => (
  <div className="mb-4">
    <label htmlFor={id} className="block text-sm font-medium text-gray-700">
      {label}
    </label>
    <textarea
      id={id}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-300 focus:ring focus:ring-indigo-200 focus:ring-opacity-50"
      rows={rows}
    />
  </div>
);

const NewProject: React.FC = () => {
  const [projectName, setProjectName] = useState("");
  const [projectDescription, setProjectDescription] = useState("");
  const [userDirectory, setUserDirectory] = useState<string>("");
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [error, setError] = useState<string | null>(null);

  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(false);
  const [authLoading, setAuthLoading] = useState<boolean>(true);

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

  const createProject = async (projectData: {
    name: string;
    description: string;
    directory: string;
  }) => {
    // const token = await getAccessTokenSilently();
    const response = await axios.post(
      "https://class4.hopekcc.org/api/projects/",
      projectData
    );
    return response.data;
  };

  const mutation = useMutation(createProject, {
    onSuccess: () => {
      // Invalidate and refetch
      queryClient.invalidateQueries("projects");
      navigate("/");
    },
  });

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();

    const sanitizedProjectName = projectName.replace(/[^a-zA-Z0-9-_]/g, "_");

    try {
      mutation.mutate({
        name: sanitizedProjectName,
        description: projectDescription,
        directory: userDirectory,
      });
    } catch (e: any) {
      setError(e.message);
    }
  };

  const handleCancel = () => {
    navigate("/"); // Navigate to the home page
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


  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center">
      <div className="bg-white p-6 rounded-lg shadow-lg">
        <h2 className="text-2xl font-bold mb-4 ">Create New Project</h2>
        <form onSubmit={handleSubmit}>
          <InputField
            id="projectName"
            label="Project Name"
            value={projectName}
            onChange={setProjectName}
            required
          />
          <TextAreaField
            id="projectDescription"
            label="Project Description"
            value={projectDescription}
            onChange={setProjectDescription}
          />
          <div className="flex justify-end space-x-2">
            <Button
              type="button"
              onClick={handleCancel}
              className="px-4 py-2 bg-gray-200 text-gray-800 rounded hover:bg-gray-300"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              className="px-4 py-2 bg-gray-400 text-gray-800 rounded hover:bg-gray-500"
              disabled={mutation.isLoading}
            >
              {mutation.isLoading ? "Creating..." : "Create Project"}
            </Button>
          </div>
        </form>
        {mutation.isError && <div>An error occurred: {error as string}</div>}
      </div>
    </div>
  );
};
export default NewProject;
