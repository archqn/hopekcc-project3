from .views import *
from django.urls import path
from django.contrib import admin

from .views import ProjectViewSet



Project_list = ProjectViewSet.as_view({
    'get': 'list_dynamic',
    'post': 'create'
})

Project_delete = ProjectViewSet.as_view({
    'delete': 'destroy'
})


urlpatterns = [
    # test
    path('test/', test_api, name='test_api'),


    path('projects/', Project_list, name='project-list'),
    path('projects/list_dynamic/', Project_list, name='project-list-dynamic'),

    # new
    path('projects/upload/', upload, name='project-upload-file'),
    path('projects/upload_folder/', upload_folder, name='project-upload-folder'),
    path('projects/delete_folder/', delete_folder, name='project-delete-folder'),
    path('projects/delete/', delete_project, name='project-delete-project'),
    path('projects/deploy/', run_bash_script, name='project-deploy-project'),    
]
