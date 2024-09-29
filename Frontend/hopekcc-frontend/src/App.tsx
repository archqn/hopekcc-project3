import "./App.css";
import { BrowserRouter as Router, Route, Routes } from "react-router-dom";
import NavBar from "./components/NavBar";
import Home from "./pages/Home";
import NewProject from "./pages/NewProject";
import ProjectDetails from "./pages/ProjectDetails";
import ProjectEditorContainer from "./pages/EditProject";
import Footer from "./components/Footer";
import MonacoEditProject from "./pages/MonacoEditProject";
import ProjectFilesPage from "./pages/ProjectFilesPage";

function App() {
  return (
    <>

      <div className="flex flex-col min-h-screen">
        <Router basename="/classroom/live/dist">
          <NavBar />
          <main className="px-8" style={{ minHeight: "450px" }}>
            <Routes>
              <Route path="" element={<Home />} />
              <Route path="/new-project" element={<NewProject />} />
              <Route path="/projects/:name" element={<ProjectFilesPage />} />
              <Route path="/projects/:id" element={<ProjectDetails />} /> // remove
              <Route path="/edit-project/:id" element={<ProjectEditorContainer />} /> // change
              <Route path="/monaco-edit-project" element={<MonacoEditProject />} /> // not needed
              
              <Route path="*" element={<Home />} />
            </Routes>
          </main>
          <div className="flex-grow">
            <Footer />
          </div>
        </Router>
      </div>
    </>
  );
}

export default App;
