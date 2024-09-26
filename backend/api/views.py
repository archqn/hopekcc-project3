import logging
from django.shortcuts import render, redirect, get_object_or_404
from django.core.files.storage import default_storage
from django.core.files.base import ContentFile
from .forms import ProjectForm, FileForm
from .models import Project, File
from django.contrib.auth.models import User 
from django.contrib.auth.decorators import login_required
import json
from firebase_admin import storage
import requests
from django.views.decorators.csrf import csrf_exempt

from django.http import JsonResponse
from rest_framework.exceptions import AuthenticationFailed
from rest_framework.request import Request
from .authentication import JWTAuthentication




def test_api(request):
    return JsonResponse({'message': 'API is working!'}, status=200)



# Authentication abstraction to reuse
def authenticate(request):
    auth = JWTAuthentication()
    try:
        user, token = auth.authenticate(request)
    except AuthenticationFailed as e:
        return JsonResponse({'status': 'error', 'message': 'Unauthorized'}, status=401)
    except Exception as e:
        return JsonResponse({'status': 'error', 'message': 'Authentication error'}, status=401)
    if not user:
        return JsonResponse({'status': 'error', 'message': 'Unauthorized'}, status=401)
    return user, token #method returns an AUTH USER. 

'''
-----------AUTH USER FORMAT REFERENCE ------------- 
---------- note: "sub" is the auth0_user_id -------------
{
  "given_name": "First name middle name",
  "family_name": "Last name",
  "nickname": "google name",
  "name": "Full name",
  "picture": "[link to image]",
  "updated_at": "2024-08-12T13:36:31.394Z",
  "email": "[email address]",
  "email_verified": true,
  "sub": "google-oauth2|   [ example string of numbers ] "
}
'''

from rest_framework.permissions import AllowAny
from .utils import upload_file_to_gcs, delete_file_from_gcs, get_file_content_from_gcs, update_file_in_gcs


'''
#CRUD files
    - view for changing / updating file contents --> file editor
    - view for renaming file (connect to frontend) --> file editor
    - view for creating new empty file --> file editor
    - view for uploading file --> file editor
'''

from .serializers import ProjectSerializer, FileSerializer
from .permissions import IsProjectOwner
from rest_framework import viewsets, status, exceptions
from rest_framework.response import Response
from django.http import JsonResponse
from django.db import transaction
import logging
import os
import shutil
import time
from rest_framework.decorators import action

logger = logging.getLogger(__name__)


class ProjectViewSet(viewsets.ModelViewSet):
    """
    This ViewSet automatically provides `list`, `create`, `update` and `destroy` actions.
    We override the `retrieve` action to include related files.

    For detail views it performs :
    - retrieve
    - update
    - partial_update
    - destro

    For list views it performs :
    - list
    - create
    """
    # queryset = Project.objects.all()
    # serializer_class = ProjectSerializer
    # TODO Add auth-0 authentication
    # authentication_classes = [JWTAuthentication]
    permission_classes = [AllowAny]
    '''
    def list(self, request, *args, **kwargs):

        user, token = authenticate(request)
        if not user:
            return JsonResponse({'status': 'error', 'message': 'Unauthorized'}, status=401)
        
        auth0_user_id = user.get('sub')  # 'sub' contains the Auth0 User ID
        
        # Filter projects by the Auth0 User ID
        queryset = Project.objects.filter(auth0_user_id=auth0_user_id)

        # Use the serializer to convert the queryset to JSON
        serializer = self.get_serializer(queryset, many=True)
        project_data = serializer.data

        try:
            files_and_folders = os.listdir(directory)
            directory_contents = [
                {"name": item, "is_directory": os.path.isdir(os.path.join(directory, item))}
                for item in files_and_folders
            ]
        except Exception as e:
            return JsonResponse({'status': 'error', 'message': 'Error accessing directory'}, status=500)
        
        return Response(directory_contents)
    '''
    
    def list_dynamic(self, request, *args, **kwargs):
        """
        New version of list that takes directory as input dynamically
        """
        # Get the directory path from the query parameters

        directory = request.query_params.get('directory')

        # If no directory is provided, use a default static directory for testing
        if not directory:
            directory = "home/"  # Default directory

        try:
            # Check if the provided directory exists
            if not os.path.exists(directory):
                return Response({'status': 'error', 'message': 'Directory does not exist'}, status=status.HTTP_400_BAD_REQUEST)

            # List all files and directories for the provided directory
            files_and_folders = os.listdir(directory)
            directory_contents = [
                {"name": item, "is_directory": os.path.isdir(os.path.join(directory, item))}
                for item in files_and_folders
            ]
        except Exception as e:
            return Response({'status': 'error', 'message': f'Error accessing directory: {str(e)}'}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

        # Return the directory contents
        return Response(directory_contents, status=status.HTTP_200_OK)
    

    def create(self, request, *args, **kwargs):

        # Parse incoming data
        data = request.data.copy()

        print(f"Received data: {data}")

        project_title = data.get('name')  # Assuming the title is stored under 'name'

        directory = data.get('directory')

        if not project_title:
            return Response({'status': 'error', 'message': 'Project name is required'}, status=status.HTTP_400_BAD_REQUEST)

        # Create folder in local directory
        project_folder_path = os.path.join(directory, project_title)

        print(f"Attempting to create directory: {project_folder_path}")

        try:
            # Check if the folder already exists
            if not os.path.exists(project_folder_path):
                os.makedirs(project_folder_path)
                print(f"Directory created: {project_folder_path}")
                return Response(project_title, status=status.HTTP_201_CREATED)
            else:
                print(f"Project already exists: {project_folder_path}")
                return JsonResponse({'status': 'error', 'message': 'Project already exists'}, status=400)
        except Exception as e:
            print(f"Error during directory creation: {str(e)}")
            return JsonResponse({'status': 'error', 'message': 'Error creating directory'}, status=500)





@csrf_exempt
def upload(request):
    """
    Handle both file and folder uploads.
    """
    if request.method != 'POST':
        return JsonResponse({'error': 'Invalid request method'}, status=405)

    # Parse project and upload data from the POST request
    project_name = request.POST.get('project')  # Using request.POST for form data
    if not project_name:
        return JsonResponse({'status': 'error', 'message': 'Project name is required'}, status=400)

    project_path = os.path.join(directory, project_name)

    # Check if project directory exists
    if not os.path.exists(project_path):
        return JsonResponse({'status': 'error', 'message': 'Project directory does not exist'}, status=400)

    # Check if files/folders are being uploaded
    files = request.FILES.getlist('file')  # Using request.FILES for file uploads

    if not files:
        return JsonResponse({'status': 'error', 'message': 'No files provided'}, status=400)

    try:
        # Handle each file
        for file in files:
            file_path = os.path.join(project_path, file.name)

            # Save file in the project directory
            with open(file_path, 'wb+') as destination:
                for chunk in file.chunks():
                    destination.write(chunk)

        return JsonResponse({'message': 'Files uploaded successfully'}, status=201)

    except Exception as e:
        return JsonResponse({'status': 'error', 'message': f'Error uploading files: {str(e)}'}, status=500)

@csrf_exempt
def upload_folder(request):
    """
    Handle folder uploads, replicating folder structure on the server.
    """

    project_name = request.POST.get('project')
    directory = request.POST.get('directory')
    if not project_name:
        return JsonResponse({'status': 'error', 'message': 'Project name is required'}, status=400)
    
    project_path = os.path.join(directory, project_name)
    if not os.path.exists(project_path):
        return JsonResponse({'status': 'error', 'message': 'Project directory does not exist'}, status=400)
    
    files = request.FILES.getlist('files')
    paths = request.POST.getlist('paths')
    directory = request.POST.get('directory')
    if not files or not paths or not directory or len(files) != len(paths):
        return JsonResponse({'status': 'error', 'message': 'No files provided'}, status=400)
    

    try:
        # Save each file, maintaining folder structure (if the folder structure is passed with file name)
        for file, relative_path in zip(files, paths):
            file_path = os.path.join(project_path, relative_path)


            # Create necessary directories
            os.makedirs(os.path.dirname(file_path), exist_ok=True)

            # Save the file
            with open(file_path, 'wb+') as destination:
                for chunk in file.chunks():
                    destination.write(chunk)

        return JsonResponse({'message': 'Folder and files uploaded successfully'}, status=201)

    except Exception as e:
        return JsonResponse({'status': 'error', 'message': f'Error uploading folder: {str(e)}'}, status=500)
    
@csrf_exempt
def delete_folder(request):
    try:
        # Parse JSON data from the request body
        data = json.loads(request.body)
        project_name = data.get('project')
        folder_name = data.get('folder')
        directory = data.get('directory')
    except json.JSONDecodeError:
        return JsonResponse({'status': 'error', 'message': 'Invalid JSON data'}, status=400)

    # Validate input
    if not project_name or not folder_name:
        return JsonResponse({'status': 'error', 'message': 'Project and folder name are required'}, status=400)

    project_path = os.path.join(directory, project_name)
    full_folder_path = os.path.join(project_path, folder_name)

    # Check if the folder exists
    if not os.path.exists(full_folder_path):
        return JsonResponse({'status': 'error', 'message': 'Folder does not exist'}, status=400)

    try:
        # Remove the folder and its contents
        shutil.rmtree(full_folder_path)
        time.sleep(1)
        return JsonResponse({'status': 'success', 'message': 'Folder deleted successfully'}, status=200)

    except Exception as e:
        return JsonResponse({'status': 'error', 'message': f'Error deleting folder: {str(e)}'}, status=500)
    
@csrf_exempt
def delete_project(request):
    """
    Deletes a project based on the name passed in the request body as JSON.
    """
    if request.method != 'DELETE':
        return JsonResponse({'status': 'error', 'message': 'Invalid request method'}, status=405)

    try:
        # Parse the JSON body to get the project name
        data = json.loads(request.body)
        project_name = data.get('name')
        base_directory = data.get("directory")
    except json.JSONDecodeError:
        return JsonResponse({'status': 'error', 'message': 'Invalid JSON data'}, status=400)

    # Validate input
    if not project_name:
        return JsonResponse({'status': 'error', 'message': 'Project name is required'}, status=400)

    # Construct the full project directory path (replace with your base directory)
    project_directory = os.path.join(base_directory, project_name)

    # Check if the project directory exists
    if not os.path.exists(project_directory):
        return JsonResponse({'status': 'error', 'message': 'Project directory does not exist'}, status=400)

    try:
        # Delete the project directory and its contents
        shutil.rmtree(project_directory)
        time.sleep(1)
        return JsonResponse({'status': 'success', 'message': f'Project {project_name} deleted successfully'}, status=200)

    except Exception as e:
        return JsonResponse({'status': 'error', 'message': f'Error deleting project: {str(e)}'}, status=500)






@csrf_exempt
def delete_project(request):
    """
    Deletes a project based on the name passed in the request body as JSON.
    """
    if request.method != 'DELETE':
        return JsonResponse({'status': 'error', 'message': 'Invalid request method'}, status=405)

    try:
        # Parse the JSON body to get the project name
        data = json.loads(request.body)
        project_name = data.get('name')
        base_directory = data.get("directory")
    except json.JSONDecodeError:
        return JsonResponse({'status': 'error', 'message': 'Invalid JSON data'}, status=400)

    # Validate input
    if not project_name:
        return JsonResponse({'status': 'error', 'message': 'Project name is required'}, status=400)

    # Construct the full project directory path (replace with your base directory)
    project_directory = os.path.join(base_directory, project_name)

    # Check if the project directory exists
    if not os.path.exists(project_directory):
        return JsonResponse({'status': 'error', 'message': 'Project directory does not exist'}, status=400)

    try:
        # Delete the project directory and its contents
        shutil.rmtree(project_directory)
        return JsonResponse({'status': 'success', 'message': f'Project {project_name} deleted successfully'}, status=200)

    except Exception as e:
        return JsonResponse({'status': 'error', 'message': f'Error deleting project: {str(e)}'}, status=500)

from dotenv import load_dotenv
import subprocess
@csrf_exempt

def run_bash_script(request):
    load_dotenv()

    email_to_port = {
        key.split('_', 2)[2]: os.getenv(key) 
        for key in os.environ.keys() 
        if key.startswith('EMAIL_PORT_')
    }
    print(email_to_port)



    if request.method == "POST":
        try:
            data = json.loads(request.body)
            print("Request body:", data)
            path = data.get('path', '')
            email= data.get('email', '')
            if not path or not email:
                return JsonResponse({'error': 'Path and email is required'}, status=400)
            
            # --------------------- CHANGE FOR LINUX ---------------------
            
            # bash_command = f"cd {path} && echo %cd% && dir"
            port = email_to_port.get(email)
            bash_command = f"sudo fuser -k {port}/tcp"
            result = subprocess.run(bash_command, shell=True, capture_output=True, text=True)
           
            bash_command = f"cd {path} && pwd "
            result = subprocess.run(bash_command, shell=True, capture_output=True, text=True)
           
            p = (result.stdout.strip())
           
            if result.returncode == 0:
                bash_command = f"flet run --web --port {port} {p}/"
                #print("command:")
                #print(bash_command)
                process = subprocess.Popen(bash_command, shell=True, stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True)
                print(f"Command is running in the background with PID: {process.pid}")

                time.sleep(2)
                return JsonResponse({'output': 'running', 'port': port}, status=200)



            else:
                return JsonResponse({'error': result.stderr.strip()}, status=400)
            






        except json.JSONDecodeError:
            return JsonResponse({'error': 'Invalid JSON'}, status=400)
    else:
        return JsonResponse({'error': 'Invalid request method'}, status=400)









# Auth0 implementation in everything


# --------------------------- for testing only ---------------------------

def edit_project_details(request, project_id):
    project = get_object_or_404(Project, id=project_id)

    # Placeholder for Auth0 user check
    temp_user = User.objects.get(username='temp_user') # replace with actual Auth0 check
    if project.user != temp_user:
        return render(request, 'api/error.html', {'message': 'Unauthorized action'})
    files = project.files.all()
    
    if request.method == 'POST':
        if 'save_changes' in request.POST:
            form = ProjectForm(request.POST, instance=project)
            if form.is_valid():
                form.save()
                return redirect('edit_project_details', project_id=project.id)
        elif 'upload_file' in request.FILES:
            file = request.FILES['upload_file']
            path = default_storage.save('uploads/' + file.name, ContentFile(file.read()))
            file_url = default_storage.url(path)
            File.objects.create(
                project=project,
                file_name=file.name,
                file_url=file_url
            )
        elif 'delete_file' in request.POST:
            file_id = request.POST.get('delete_file')
            file_to_delete = get_object_or_404(File, id=file_id)
            file_to_delete.delete()
        elif 'delete_project' in request.POST:
            project.delete()
            return redirect('user_projects')

    form = ProjectForm(instance=project)
    return render(request, 'api/edit_project_details.html', {'project': project, 'files': files, 'form': form})
