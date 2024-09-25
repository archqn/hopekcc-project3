import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import axios from "axios";
import { useQuery } from "react-query";
import { Clock, Calendar } from "lucide-react";
import { Project } from "../utils/types.ts";
import { DeleteButton } from "../components/projectComponents/Buttons.tsx";
import SearchBar from "../components/SearchBar.tsx";
import { jwtDecode } from 'jwt-decode';

interface ProjectListProps {
  projects: Project[];
  isLoading: boolean;
}

interface DecodedToken {
  email: string;
  name: string;
  picture: string;
}

const ProjectList = ({ projects, isLoading }: ProjectListProps) => {
  if (isLoading) {
    return <div>Loading projects...</div>;
  }

  const ProjectHeader = () => {
    return (
      <div className="grid grid-cols-12 gap-4 items-center py-3 rounded-md transition-colors duration-150">
        <div className="col-span-3 text-left">Name</div>
        <div className="col-span-4 text-left">Description</div>
        <div className="col-span-2 text-left flex">
          Last Updated <Clock size={14} className="m-1" />
        </div>
        <div className="col-span-2 text-left flex ">
          Created <Calendar size={14} className="m-1 " />{" "}
        </div>
        <div className="col-span-1 text-left flex "> </div>
      </div>
    );
  };

  const ProjectItem = ({ project }: { project: Project }) => {
    const [userDirectory, setUserDirectory] = useState<string | null>(null);

    useEffect(() => {
      const token = localStorage.getItem("google_token");
      if (token) {
        try {
          const decodedToken = jwtDecode<DecodedToken>(token);
          const email = decodedToken.email;

          const formattedEmail = `ext_${email.replace(/[@.]/g, "_")}`;
          const rootDirectory = "home/"; 
          setUserDirectory(`${rootDirectory}${formattedEmail}`);
        } catch (error) {
          console.error("Error decoding token:", error);
          setUserDirectory(null);
        }
      }
    }, []);

    const handleProjectDelete = async (name: string) => {
      if (!window.confirm(`Are you sure you want to delete the project: ${name}?`)) {
        return;
      }

      try {
        const response = await axios.delete("https://class4.hopekcc.org/api/projects/delete/", {
          data: {
            name: name, 
            directory: userDirectory,
          }
        });

        if (response.status === 200) {
          alert("Project deleted successfully.");
          window.location.reload();
        } else {
          console.error("Failed to delete project:", response.data);
        }
      } catch (error) {
        console.error("Error deleting project:", error);
        alert("Error deleting project.");
      }
    };

    return (
      <div className="grid grid-cols-12 gap-4 items-center py-3 hover:bg-gray-50 rounded-md transition-colors duration-150">
        <div className="col-span-3">
          <h3 className="text-left font-medium text-blue-800 hover:underline truncate">
            <Link to={`/projects/${project.name}`}>{project.name}</Link>
          </h3>
        </div>
        <div className="col-span-4 text-sm text-left text-gray-500 truncate">
          {project.description}
        </div>
        <div className="col-span-2 flex items-center text-xs text-gray-400">
          <span className="truncate">{new Date(project.updated_at).toLocaleDateString()}</span>
        </div>
        <div className="col-span-2 flex items-center text-xs text-gray-400">
          <span className="truncate">{new Date(project.created_at).toLocaleDateString()}</span>
        </div>
        <DeleteButton onClick={() => handleProjectDelete(project.name)} className="mx-2" />
      </div>
    );
  };

  return (
    <div className="bg-gray-100 container mx-auto px-4 py-4">
      <div className="divide-y divide-gray-200">
        <ProjectHeader />
        {projects.length === 0 ? (
          <p className="text-gray-500 italic py-3">No projects available</p>
        ) : (
          projects.map((project: Project) => (
            <ProjectItem key={project.id} project={project} />
          ))
        )}
      </div>
    </div>
  );
};

const Home = () => {
  const [filteredProjects, setFilteredProjects] = useState<Project[]>([]);
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(false);
  const [authLoading, setAuthLoading] = useState<boolean>(true);
  const [userDirectory, setUserDirectory] = useState<string>("");

  const fetchProjects = async (): Promise<Project[]> => {
    const response = await axios.get(`https://class4.hopekcc.org/api/projects/list_dynamic/?directory=${userDirectory}`);
    return Array.isArray(response.data) ? response.data : [];
  };

  const { data = [], isLoading, isError, error } = useQuery<Project[]>(
    "projects",
    fetchProjects,
    {
      enabled: !!userDirectory,
      onSuccess: (projects) => {
        setFilteredProjects(projects);
      },
    }
  );

  useEffect(() => {
    const token = localStorage.getItem("google_token");
    if (token) {
      try {
        const decodedToken = jwtDecode<DecodedToken>(token);
        const email = decodedToken.email;
        const formattedEmail = `ext_${email.replace(/[@.]/g, "_")}`;
        const rootDirectory = "home/"; 
        setUserDirectory(`${rootDirectory}${formattedEmail}`);
        setIsAuthenticated(true);
      } catch (error) {
        console.error("Error decoding token:", error);
        setIsAuthenticated(false);
      }
    } else {
      setIsAuthenticated(false);
    }
    setAuthLoading(false);
  }, []);

  const handleSearch = (query: string) => {
    setSearchQuery(query);
    if (query.trim() === "") {
      setFilteredProjects(data || []);
    }
  };

  const handleSearchSubmit = () => {
    if (searchQuery.trim() === "") {
      setFilteredProjects(data || []);
    } else {
      const filtered = (data || []).filter(
        (project) =>
          project.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
          project.description.toLowerCase().includes(searchQuery.toLowerCase())
      );
      setFilteredProjects(filtered);
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

  if (isLoading) {
    return <div>Loading projects...</div>;
  }

  if (isError) {
    return (
      <div>
        Error loading projects:{" "}
        {error instanceof Error ? error.message : "Unknown error"}
      </div>
    );
  }

  return (
    <div>
      {/* Search bar Section */}
      <section className="mx-auto px-4 py-4">
        <SearchBar
          onSearch={handleSearch}
          onSubmit={handleSearchSubmit}
        />
      </section>

      {/* Create Project Section */}
      <section className="bg-gray-100 mx-auto px-4 py-8">
        <div className="mb-6">
          <h2 className="text-2xl text-left font-semibold mb-2 text-gray-800">
            Create Project
          </h2>
          <div className="flex justify-center">
            <div className="relative">
              <Link
                to="/new-project"
                className="relative w-48 h-12 flex items-center justify-center group"
              >
                <div className="absolute inset-0 bg-[#a8e9fd] transition-transform duration-300 ease-in-out transform group-hover:skew-x-[10deg] group-hover:scale-105 group-hover:shadow-lg z-0"></div>
                <div className="relative text-lg font-bold text-[#1d769f] transition-transform duration-300 ease-in-out transform group-hover:scale-105 z-10">
                  New Project
                </div>
                <div className="absolute inset-0 border-4 border-[#1d769f] transition-transform duration-300 ease-in-out transform group-hover:skew-x-[-10deg] group-hover:scale-105 z-5"></div>
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* Projects Section */}
      <section className="mx-auto px-4 py-8">
        <h2 className="text-2xl text-left font-semibold mb-6 text-gray-800">
          Projects
        </h2>
        <ProjectList projects={filteredProjects} isLoading={isLoading} />
      </section>
    </div>
  );
};

export default Home;

