const LogoutButton = () => {

  const onLogout = () => {
    console.log('Logged out successfully');
    localStorage.removeItem('google_token'); // Adjust this to how you store the token
    window.location.reload();
  };

  return (
    <div id="signOutButton">
      <button onClick={onLogout}>Logout</button>
    </div>
  )
}

export default LogoutButton;