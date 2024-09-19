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

from rest_framework.permissions import IsAuthenticated
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
from rest_framework.decorators import action

directory = r"C:\Users\uclam\Downloads\Lucas"

logger = logging.getLogger(__name__)
'''
class FileViewSet(viewsets.ModelViewSet):
    """
    This ViewSet provides `list`, `create`, `retrieve`,
    `update` and `destroy` actions.
    
    Additionally, in detail views it'll retrieve the file content from Google Cloud Storage.
    """
    
    queryset = File.objects.all()
    serializer_class = FileSerializer
    authentication_classes = [JWTAuthentication]
    permission_classes = [IsProjectOwner]
    
    def create(self, request, *args, **kwargs):
        file = request.FILES.get('file')
        if not file:
            return Response({'error': 'No file provided'}, status=status.HTTP_400_BAD_REQUEST)

        project_id = request.data.get('project')
        if not project_id:
            return Response({'error': 'Project ID is required'}, status=status.HTTP_400_BAD_REQUEST)

        try:
            project = Project.objects.get(id=project_id)
        except Project.DoesNotExist:
            return Response({'error': 'Project not found'}, status=status.HTTP_404_NOT_FOUND)
        
        # Create the project directory using the project name
        project_folder = os.path.join(directory, project.name)
        try:
            if not os.path.exists(project_folder):
                os.makedirs(project_folder)
                logger.info(f"Directory created: {project_folder}")
        except Exception as e:
            logger.error(f"Error creating project directory: {str(e)}")
            return Response({'error': 'Error creating project directory'}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

        try:
            # Save the file to the project folder
            file_path = os.path.join(project_folder, file.name)
            with default_storage.open(file_path, 'wb+') as destination:
                for chunk in file.chunks():
                    destination.write(chunk)

            # Build the file URL (in this case, just the file path)
            file_url = file_path
            
            # Save the file information in the database
            serializer = self.get_serializer(data={
                'project': project_id,
                'file_name': file.name,
                'file_url': file_url  # Save the local path in the database
            })
            serializer.is_valid(raise_exception=True)
            self.perform_create(serializer)
            headers = self.get_success_headers(serializer.data)
            logger.info(f"File created: {serializer.data['file_name']} for project {project_id}")
            return Response(serializer.data, status=status.HTTP_201_CREATED, headers=headers)

        except Exception as e:
            logger.error(f"Error creating file: {str(e)}")
            return Response({'error': str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)
        
        

    def retrieve(self, request, *args, **kwargs):
        # additionally fetch the content files in detail view
        instance = self.get_object()
        serializer = self.get_serializer(instance)
        data = serializer.data
        try:
            data['content'] = get_file_content_from_gcs(instance.file_url)
            logger.info(f"File content retrieved: {instance.file_name}")
            return Response(data)
        except exceptions.NotFound:
            logger.warning(f"File not found in storage: {instance.file_url}")
            return Response({'error': 'File not found in storage'}, status=status.HTTP_404_NOT_FOUND)
        except Exception as e:
            logger.error(f"Error retrieving file content: {str(e)}")
            return Response({'error': str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

    def update(self, request, *args, **kwargs):
        """handles both partial and full update"""
        partial = kwargs.pop('partial', False)
        instance = self.get_object()
        file = request.FILES.get('file')

        # The permission class will handle ownership check

        try:
            # Create a mutable copy of the request data
            mutable_data = request.data.copy()

            if file:
                file_url = update_file_in_gcs(file, instance.file_url)
                mutable_data['file_url'] = file_url

                
            serializer = self.get_serializer(instance, data=mutable_data, partial=partial)
            serializer.is_valid(raise_exception=True)
            self.perform_update(serializer)

            logger.info(f"File updated: {instance.file_name}")
            return Response(serializer.data)
        except exceptions.NotFound:
            logger.warning(f"File not found in storage: {instance.file_url}")
            return Response({'error': 'File not found in storage'}, status=status.HTTP_404_NOT_FOUND)
        except Exception as e:
            logger.error(f"Error updating file: {str(e)}")
            return Response({'error': str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

    def destroy(self, request, *args, **kwargs):
        instance = self.get_object()
        
        # The permission class will handle ownership check
        
        try:
            delete_file_from_gcs(instance.file_url)
            self.perform_destroy(instance)
            logger.info(f"File deleted: {instance.file_name}")
            return Response(status=status.HTTP_204_NO_CONTENT)
        except Exception as e:
            logger.error(f"Error deleting file: {str(e)}")
            return Response({'error': str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

"""
CRUD 
    view for changing project title --> file editor
    view for changing project description --> file editor
    view for deleting project --> file editor
    view for creating project --> file editor
"""
'''

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
    queryset = Project.objects.all()
    serializer_class = ProjectSerializer
    #T ODO Add auth-0 authentication
    authentication_classes = [JWTAuthentication]
    permission_classes = [IsProjectOwner]
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
    

    def list_dynamic(self, request, *args, **kwargs):
        """
        New version of list that takes directory as input dynamically
        """
        # Get the directory path from the query parameters

        directory = request.query_params.get('directory')

        # If no directory is provided, use a default static directory for testing
        if not directory:
            directory = r"C:\Users\uclam\Downloads\Lucas"  # Default directory

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

        user, token = authenticate(request)
        if not user:
            return JsonResponse({'status': 'error', 'message': 'Unauthorized'}, status=401)

        # Parse incoming data
        data = request.data.copy()
        project_title = data.get('name')  # Assuming the title is stored under 'name'
        # data['auth0_user_id'] = user.get('sub')  # Add Auth0 user ID to the data

        # Create folder in local directory
        project_folder_path = os.path.join(directory, project_title)

        try:
            # Check if the folder already exists
            if not os.path.exists(project_folder_path):
                os.makedirs(project_folder_path)
            else:
                return JsonResponse({'status': 'error', 'message': 'Directory already exists'}, status=400)
        except Exception as e:
            return JsonResponse({'status': 'error', 'message': 'Error creating directory'}, status=500)

        # Use the serializer to validate and save the project
        serializer = self.get_serializer(data=data)
        if serializer.is_valid(raise_exception=True):
            self.perform_create(serializer)
            return Response(serializer.data, status=status.HTTP_201_CREATED)

        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
    



    def retrieve(self, request, *args, **kwargs):
        instance = self.get_object()
        serializer = self.get_serializer(instance)
        data = serializer.data
        # The related files are already included in the serializer
        return Response(data)
    

    # new - doesnt work
    @transaction.atomic
    def destroy(self, request, *args, **kwargs):
        """
        Deletes a project based on the directory path passed in query parameters.
        """
        # Get the directory from query parameters
        project_name = request.query_params.get('name')

        # Check if directory is provided
        if not project_name:
            return Response({'status': 'error', 'message': 'project name is required'}, status=status.HTTP_400_BAD_REQUEST)

        project_directory = os.path.join(directory, project_name)
        # Check if the directory exists
        if not os.path.exists(project_directory):
            return Response({'status': 'error', 'message': 'Project directory does not exist'}, status=status.HTTP_400_BAD_REQUEST)

        try:
            # Remove the directory and its contents
            shutil.rmtree(project_directory)
            return Response({'status': 'success', 'message': f'Project directory {project_directory} deleted successfully'}, status=status.HTTP_200_OK)
        
        except Exception as e:
            return Response({'status': 'error', 'message': f'Error deleting project directory: {str(e)}'}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)
    
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
    # Authenticate user
    user = authenticate(request)
    if not user:
        return JsonResponse({'status': 'error', 'message': 'Unauthorized'}, status=401)

    project_name = request.POST.get('project')
    if not project_name:
        return JsonResponse({'status': 'error', 'message': 'Project name is required'}, status=400)
    
    project_path = os.path.join(directory, project_name)
    if not os.path.exists(project_path):
        return JsonResponse({'status': 'error', 'message': 'Project directory does not exist'}, status=400)
    
    files = request.FILES.getlist('files')
    paths = request.POST.getlist('paths')
    if not files or not paths or len(files) != len(paths):
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
    except json.JSONDecodeError:
        return JsonResponse({'status': 'error', 'message': 'Invalid JSON data'}, status=400)

    # Validate input
    if not project_name or not folder_name:
        return JsonResponse({'status': 'error', 'message': 'Project and folder name are required'}, status=400)

    # Construct the full folder path
    directory = r"C:\Users\uclam\Downloads\Lucas"  # Update this to your root directory if needed
    project_path = os.path.join(directory, project_name)
    full_folder_path = os.path.join(project_path, folder_name)

    # Check if the folder exists
    if not os.path.exists(full_folder_path):
        return JsonResponse({'status': 'error', 'message': 'Folder does not exist'}, status=400)

    try:
        # Remove the folder and its contents
        shutil.rmtree(full_folder_path)
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
    except json.JSONDecodeError:
        return JsonResponse({'status': 'error', 'message': 'Invalid JSON data'}, status=400)

    # Validate input
    if not project_name:
        return JsonResponse({'status': 'error', 'message': 'Project name is required'}, status=400)

    # Construct the full project directory path (replace with your base directory)
    base_directory = r"C:\Users\uclam\Downloads\Lucas"  # Replace with your actual base directory
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
