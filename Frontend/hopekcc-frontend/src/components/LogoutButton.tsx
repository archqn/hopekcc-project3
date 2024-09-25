

interface LogoutButtonProps {
  onLogout: () => void;
}







const LogoutButton: React.FC<LogoutButtonProps> = ({ onLogout }) => {

 


  return (
    <div id="signOutButton">
      <button onClick={onLogout}>Logout</button>
    </div>
  )
}

export default LogoutButton;
