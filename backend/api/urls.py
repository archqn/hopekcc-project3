from .views import *
from django.urls import path
from django.contrib import admin

from .views import ProjectViewSet
'''
File_list = FileViewSet.as_view({
    'get': 'list',
    'post': 'create'
})
File_detail = FileViewSet.as_view({
    'get': 'retrieve',
    'put': 'update',
    'patch': 'partial_update',
    'delete': 'destroy'
})
'''

Project_list = ProjectViewSet.as_view({
    'get': 'list',
    'post': 'create'
})

Project_detail = ProjectViewSet.as_view({
    'get': 'retrieve',
    'put': 'update',
    'patch': 'partial_update',
})

# new

Project_list_dynamic = ProjectViewSet.as_view({
    'get': 'list_dynamic'
})

Project_delete = ProjectViewSet.as_view({
    'delete': 'destroy'
})



# #----unused
# user_list = UserViewSet.as_view({
#     'get': 'list'
# })
# user_detail = UserViewSet.as_view({
#     'get': 'retrieve'
# })
# #----unused

urlpatterns = [
    path('projects/', Project_list, name='project-list'),
    path('projects/<int:pk>/', Project_detail, name='project-detail'),
    path('projects/list_dynamic/', Project_list_dynamic, name='project-list-dynamic'),

    # new
    path('projects/upload/', upload, name='project-upload-file'),
    path('projects/upload_folder/', upload_folder, name='project-upload-folder'),
    path('projects/delete_folder/', delete_folder, name='project-delete-folder'),
    path('projects/delete/', delete_project, name='project-delete-project'),
    

    # old
    # path('files/', File_list, name='file-list'),
    # path('files/<int:pk>/', File_detail, name='file-detail'),

    # path('create_project/', create_project, name='create_project'),
    # path('upload/<int:project_id>/', upload_file, name='upload_file'),
    # path('home/', display_user_projects_home, name='home'),
    # path('project_details/<int:project_id>/', get_project_details, name='get_project_details'),
    # path('delete_file/<int:project_id>/<int:file_id>/', delete_file, name='delete_file'),
    
    # path('projects/', list_user_projects, name='list_user_projects'),
    
    # path('edit_project_details/<int:project_id>/', edit_project_details, name='edit_project_details'), # for testing purposes
]