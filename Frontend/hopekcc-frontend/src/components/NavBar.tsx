import { useState, useEffect} from "react";
import { Link, useLocation } from "react-router-dom";
import { CredentialResponse } from '@react-oauth/google';
import { jwtDecode } from 'jwt-decode';

// import { useAuth0 } from "@auth0/auth0-react";
// import { User } from "@auth0/auth0-spa-js";
// import UserInfo from "./UserInfo";

import { House, ArrowLeft, Edit, FileText, Eye } from "lucide-react";
import { TitleDisplayButton } from "./projectComponents/Buttons";

import LoginButton from "./LoginButton";
import LogoutButton from "./LogoutButton";


// Define the structure of the decoded token
interface DecodedToken {
  email: string;
  name: string;
  picture: string;
}

const navClass = "flex justify-between items-center bg-gray-500 text-white p-4 ";
const ulClass = "flex space-x-4 items-center";
const liClass = "mx-2 px-2";
const linkClass = "text-white";
const activeLinkClass = "underline";


export const NavBar = () => {
  // const { isAuthenticated, user } = useAuth0();
  const location = useLocation();
  const [user, setUser] = useState<string | null>(null);

  const getLinkClass = (path: string) =>
    `${linkClass} ${location.pathname === path ? activeLinkClass : ""}`;
  // don't display if editing

  const onSuccess = (credentialResponse: CredentialResponse) => {
    const token = credentialResponse.credential;
    if (token) {
      // Store the token in local storage
      localStorage.setItem("google_token", token);

      // Decode the token to extract user information (email)
      const decodedToken = jwtDecode<DecodedToken>(token);
      setUser(decodedToken.email); // Set user email
    }
    window.location.reload();
  };

  const handleLogout = () => {
    setUser(null);
    localStorage.removeItem("google_token");
    window.location.reload(); 
  };

  useEffect(() => {
    const token = localStorage.getItem("google_token");
    if (token) {
      const decodedToken = jwtDecode<DecodedToken>(token);
      setUser(decodedToken.email);
    }
  }, []);
  
  if (location.pathname.includes("edit-project")) return null;
  return (
    <nav className={navClass} style={{ backgroundColor: "#1d769f" }}>
      <div className="flex justify-between items-center w-full">
        {/* Left Side - Logo */}
        <ul className={`${ulClass} items-center`}>
          <li className={liClass}>
            <img
              width="281"
              height="49"
              src="https://www.hopekcc.org/wp-content/uploads/2024/03/New_Logo-02-White.png"
              alt="HopeKCC"
              decoding="async"
              sizes="(max-width: 281px) 100vw, 281px"
            />
          </li>
        </ul>

        {/* Right Side - Links and User Info */}
        <ul className={`${ulClass} items-center space-x-4`}>
          <li className={liClass}>
            <Link to="/" className={getLinkClass("/")}>
              Home
            </Link>
          </li>
          <li className={liClass}>
            <Link to="/new-project" className={getLinkClass("/new-project")}>
              New Project
            </Link>
          </li>
          <li className={liClass}>
            {user ? (
              <>
                <span>Signed in as {user}</span>
                <LogoutButton onLogout={handleLogout}/>
              </>
            ) : (
              <LoginButton onSuccess={onSuccess}/>
            )}
          </li>
        </ul>
      </div>
    </nav>
  );
};



export const ProjectNavBar = ({
  onSwitchView,
  onCollapseDesc,
  onTitleChange,
  isEditing,
  title,
  modifiedTime,
}: {
  onCollapseDesc: () => void;
  onSwitchView: () => void;
  onTitleChange: (oldTitle: string, newTitle: string) => void;
  isEditing: boolean;
  title: string;
  modifiedTime: string;
}) => {
  return (
    <nav
      className={
        "flex justify-between items-center bg-gray-500 text-white p-4 "
      }
      style={{ backgroundColor: "#1d769f" }}
    >
      <ul className={ulClass}>
        <li className={liClass}>
          <Link to={`/projects/`} className="flex items-center">
            <ArrowLeft size={20} className="mx-2" />
            <span>Back</span>
          </Link>
        </li>
        <li className={liClass}>
          <Link to={`/`} className="flex items-center">
            <House size={20} className="mx-2" />
            <span>Home</span>
          </Link>
        </li>
      </ul>
      <ul className={ulClass}>
        <h1 className=" text-3xl font-bold">
          <TitleDisplayButton title={title} onRename={onTitleChange} />
        </h1>

        <li className="text-gray-400">
          <div>
            <p>Last Modified: {new Date(modifiedTime).toLocaleDateString()}</p>
          </div>
        </li>
      </ul>
      <ul className={ulClass}>
        <li className={liClass}>
          <button className="flex items-center" onClick={onSwitchView}>
            {isEditing ? ( //Display view or Edit
              <>
                <Eye size={20} className="mx-2" />
                View
              </>
            ) : (
              <>
                <Edit size={20} className="mx-2" />
                Edit
              </>
            )}
          </button>
        </li>

        <li className={liClass}>
          <button className="flex" onClick={onCollapseDesc}>
            <FileText className="mx-2" /> Desc
          </button>
        </li>
      </ul>
    </nav>
  );
};

export default NavBar;
