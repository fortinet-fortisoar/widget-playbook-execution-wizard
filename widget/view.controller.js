/* Copyright start
  MIT License
  Copyright (c) 2024 Fortinet Inc
  Copyright end */
'use strict';
(function () {
  angular
    .module('cybersponse')
    .controller('playbookExecutionWizard100Ctrl', playbookExecutionWizard100Ctrl);

  playbookExecutionWizard100Ctrl.$inject = ['$scope', '$q', 'WizardHandler', '$resource', 'API', '$uibModal', '_', 'Entity', '$filter', 'websocketService', '$http', 'usersService', 'playbookService', 'toaster', '$state', 'currentPermissionsService', 'ALL_RECORDS_SIZE', 'CommonUtils', '$rootScope', '$timeout'];

  function playbookExecutionWizard100Ctrl($scope, $q, WizardHandler, $resource, API, $uibModal, _, Entity, $filter, websocketService, $http, usersService, playbookService, toaster, $state, currentPermissionsService, ALL_RECORDS_SIZE, CommonUtils, $rootScope, $timeout) {
    $scope.showDataWizard = false;
    $scope.close = close;
    $scope.moveNext = moveNext;
    $scope.moveFinishNext = moveFinishNext;
    $scope.movePrevious = movePrevious;
    $scope.executeGridPlaybook = executeGridPlaybook;
    $scope.playbookDetails = '';
    $scope.playbookDescription = '';
    $scope.triggerStep = {};
    $scope.commentsContent = [];
    $scope.manualInputContent = [];
    $scope.manualInputResult = [];
    $scope.taskRecordIRI = '';
    $scope.parent_wf_id = '';
    $scope.awaitingStep = undefined;
    $scope.pendingInputTabProcessing = false;
    $scope.isPlaybookAwaiting = false;
    $scope.isPlaybookActive = false;
    $scope.taskId = undefined;
    $scope.awaitingStepInput = undefined;
    $scope.loadProcessing = false;
    $scope.playbookExecutionFailed = false;
    $scope.loadPlaybookData = loadPlaybookData;
    $state.params.tab = 'comments';
    $scope.activeTab = $state.params.tab === 'logs' ? 2 : 1;
    $scope.$watch('activeTab', function ($newTab, $oldTab) {
      if (!$oldTab) {
        // skip first run
        return;
      }
      $state.go('.', {
        tab: $scope.activeTab === 1 ? 'comments' : 'logs'
      }, {
        notify: false,
        location: 'replace'
      });
    });

    var subscription;
    var commentSubscription;

    $scope.selectedEnv = {
      selectedRecordPlaybook: []
    };
    $scope.jsonToGrid = false;
    initWebsocket();
    $scope.$on('websocket:reconnect', function () {
      initWebsocket();
    });

    function initWebsocket() {
      websocketService.subscribe('runningworkflow', function (data) {
        if (data.parent_wf === 'null' && $scope.loadProcessing === false) {
          $scope.loadProcessing = true;
          $scope.parent_wf_id = data.instance_ids;
        }
        //do nothing in case of notification recieved from same websocketSession. As it is handled gracefully.
        if (data.sourceWebsocketId !== websocketService.getWebsocketSessionId()) {
          if ($scope.taskId && data.task_id && data.task_id === $scope.taskId && data.parent_wf === 'null') {
            angular.element(document.querySelector("[name='solutionpackWizard']").querySelector("[data-ng-controller='RunningPlaybookCtl']")).scope().params.srchBox = data.instance_ids;
            document.querySelector("[name='solutionpackWizard']").getElementsByClassName("executed-pb-filter-container")[0].style.display = 'none';
            WizardHandler.wizard('solutionpackWizard').next();
            $scope.taskId = undefined;
          }
        }
        if (data.status == 'awaiting') {
          $resource(API.WORKFLOW + 'api/workflows/' + data.instance_ids + '/?').get({}).$promise.then(function (response) {
            $scope.awaitingStep = _.find(response.steps, { 'func': 'manual_input', 'status': 'awaiting' });
            if ($scope.awaitingStep !== undefined) {
              $resource('/api' + $scope.awaitingStep['@id'] + '?').get({}).$promise.then(function (resp) {
                _getPendingInputDetails(resp.result.wfinput_id);
              });
            }
          });
        }
        if (data.status == 'failed') {
          $resource(API.WORKFLOW + 'api/workflows/' + data.instance_ids + '/?').get({}).$promise.then(function (response) {
            $scope.playbookExecutionFailed = true;
            console.log(data.result["Error message"]);
          });
        }
        if (data.status == 'finished') {
          getPlaybookResult();
          $scope.playbookInstanceIds = data;
        }
      }).then(function (data) {
        subscription = data;
      });
    }

    function commentWebsocket() {
      $scope.commentsContent = [];
      var moduleID = $scope.taskRecordIRI;
      websocketService.subscribe(moduleID + '/comments', function (data) {
        //do nothing in case of notification recieved from same websocketSession. As it is handled gracefully.
        if (data.sourceWebsocketId !== websocketService.getWebsocketSessionId()) {
          if (data.operation === 'create' || data.operation === 'update') {
            _getContent(data);
          }
        }
      }).then(function (data) {
        commentSubscription = data;
      });
    }

    $scope.$on('$destroy', function () {
      if (subscription) {
        websocketService.unsubscribe(subscription);
      }
      if (commentSubscription) {
        $rootScope.pendingDecisionModalOpen = false;
        websocketService.unsubscribe(commentSubscription);
      }
    });

    $scope.isObject = function (variable) {
      return angular.isObject(variable);
    };

    function close() {
      $scope.$parent.$parent.$parent.$ctrl.handleClose();
    }

    function movePrevious() {
      WizardHandler.wizard('solutionpackWizard').previous();
    }

    function moveFinishNext() {
      WizardHandler.wizard('solutionpackWizard').next();
      getPlaybookResult();
    }

    function moveNext() {
      loadPlaybookData($state.params.tab);
      if ($scope.jsonToGrid) {
        _checkTaskRecord();
        executeGridPlaybook($scope.payload.playbookDetails, $scope.triggerStep);
      }
      else {
        $scope.taskRecordIRI = $scope.payload.selectedRecord['@id'].replace('/api/3/', '');
        $rootScope.pendingDecisionModalOpen = true;
        commentWebsocket();
        executeGridPlaybook($scope.payload.playbookDetails, $scope.triggerStep);
      }
    }

    function loadPlaybookData(tab) {
      if (tab === 'logs') {
        $scope.$broadcast('cs:getList');
      }
    }

    function _checkTaskRecord() {
      var defer = $q.defer();
      var queryBody = {
        "logic": "AND",
        "filters": [
          {
            "field": "name",
            "operator": "eq",
            "value": $scope.payload.selectedRecord[0].uuid,
            "type": "primitive"
          },
          {
            "type": "object",
            "field": "status",
            "operator": "neq",
            "value": "/api/3/picklists/343f4b67-e929-4205-bf95-ba5b70545fed"
          }
        ]
      };
      var queryString = {
        $limit: ALL_RECORDS_SIZE
      };
      return $resource(API.QUERY + 'tasks').save(queryString, queryBody).$promise.then(function (response) {
        if (response['hydra:member'] && response['hydra:member'].length > 0) {
          $scope.taskRecordIRI = response['hydra:member'][0]['@id'].replace('/api/3/', '');
          commentWebsocket();
        }
        else {
          _createTaskRecord();
        }
        defer.resolve(response);
      }, function (error) {
        defer.reject(error);
      });
    }

    function _createTaskRecord() {
      var defer = $q.defer();
      var tableRows = '| Key | Value | \n| --- | --- |';
      for (var key in $scope.payload.selectedRecord[0]) {
        if ($scope.payload.selectedRecord[0].hasOwnProperty(key)) {
          var value = $scope.payload.selectedRecord[0][key];
          tableRows += '\n|' + key + '|' + value + '|';
        }
      }
      var reqBody = {
        method: 'POST',
        url: API.BASE + 'tasks',
        headers: {
          'Accept': 'application/json, text/plain, */*'
        },
        data: {
          "name": $scope.payload.selectedRecord[0].uuid,
          "description": tableRows,
          "type": "/api/3/picklists/6d113f01-123a-4c78-b68c-029e16df9b8b",
          "priority": "/api/3/picklists/539083a6-01f6-4ff9-a588-778cfdad4671",
          "status": "/api/3/picklists/7669725a-28cc-4b19-98a3-9ca71e0f88f4",
          "conflict": false,
          "body": $scope.payload.selectedRecord[0].description
        }
      };
      $http(reqBody).then(function (response) {
        if (response.status === 201) {
          $scope.taskRecordIRI = response.data['@id'].replace('/api/3/', '');
          commentWebsocket();
        }
        defer.resolve(response);
      }, function (error) {
        defer.reject(error);
      });
      return defer.promise;
    }

    function _getContent(data) {
      $resource(data.entityUuid[0]).get({}).$promise.then(function (details) {
        $scope.commentsContent.push(details.content.replace('<p>', '<p class="display-inline">'));
      });
    }

    function _getPendingInputDetails(manualInputId) {
      $scope.pendingInputTabProcessing = true;
      var currentUser = usersService.getCurrentUser();
      var user = angular.copy(currentUser);
      user.teams.push(currentUser['@id']);
      var params = { 'owners': user.teams };
      playbookService.getPendingDecision(manualInputId, params).then(function (data) {
        if (angular.equals({}, data)) {
          $scope.pendingInputTabProcessing = false;
          return;
        }
        $scope.commentsContent.push(data);
      }, function () {
        toaster.error({
          body: 'Error in getting Pending Input data'
        });
        $scope.pendingInputTabProcessing = false;
      });
    }

    function executeGridPlaybook(playbook, triggerStep) {
      var deferred = $q.defer();
      $resource(API.BASE + API.WORKFLOWS + playbook.uuid).get({ '$relationships': true }).$promise.then(function (playbook) {
        var entity = new Entity(triggerStep.arguments.resources[0]);
        entity.loadFields().then(function () {
          if (triggerStep.arguments.inputVariables && triggerStep.arguments.inputVariables.length > 0) {
            var modalInstance = $uibModal.open({
              templateUrl: 'app/components/modals/inputVariables.html',
              controller: 'InputVariablesCtrl',
              windowClass: 'pb-exec-wizard-input-prompt-modal no-animation',
              animation: false,
              backdrop: 'static',
              resolve: {
                playbook: playbook,
                entity: angular.copy(entity),
                rows: function () {
                  if (!$scope.jsonToGrid) {
                    return _.map([$scope.payload.selectedRecord], obj => obj);
                  }
                  else {
                    return $scope.payload.selectedRecord;
                  }
                }
              }
            });
            $timeout(function() {
              var widgetModalElement = document.querySelector('.modal-backdrop');
              var widgetModalZindex = parseInt(widgetModalElement.style.getPropertyValue('z-index'), 10);
              widgetModalElement.setAttribute('style', 'z-index:' + (widgetModalZindex + 20));
            });
            modalInstance.result.then(function (result) {
              triggerPlaybookWithRecords(playbook, triggerStep.arguments.resources[0], $scope.payload.selectedRecord, result).then(function (workflowID) {
                deferred.resolve();
              });
            });
          } else {
            triggerPlaybookWithRecords(playbook, triggerStep.arguments.resources[0], $scope.payload.selectedRecord, { inputVariables: {} }).then(function (workflowID) {
              deferred.resolve();
            });
          }
        });
      });
      return deferred.promise;
    }

    function triggerPlaybookWithRecords(playbook, module, selectedRows, manualTriggerInput) {
      var apiNoTrigger = API.MANUAL_TRIGGER + playbook.uuid;
      if (!$scope.jsonToGrid) {
        var selectedRows = _.map([selectedRows], obj => obj);
      }
      var env = {
        'request': {
          'data': {
            'records': selectedRows,
            'singleRecordExecution': true,
            '__resource': module,
            '__uuid': playbook.uuid
          }
        }
      };
      env = _.extend(env, manualTriggerInput.inputVariables);
      return $resource(apiNoTrigger).save(env).$promise.then(function (response) {
        $scope.taskId = response.task_id;
        $scope.loadProcessing = false;
      });
    }

    function getPlaybookResult() {
      var endpoint = API.WORKFLOW + 'api/workflows/' + $scope.parent_wf_id + '/';
      $http.get(endpoint).then(function (response) {
        if (response.data.status === 'finished') {
          $scope.loadProcessing = false;
          $scope.playbookResult = response.data.result;
        }
      });
    }

    function _init() {
      if (!currentPermissionsService.availablePermission('workflows', 'execute')) {
        toaster.error({
          body: "You dont have permission to execute the playbook"
        });
        return;
      }
      if (!CommonUtils.isObject($scope.payload.selectedRecord)) {
        $scope.jsonToGrid = true;
      }
      $scope.triggerStep = _.find($scope.payload.playbookDetails.steps, function (item) { return item.uuid === $filter('getEndPathName')($scope.payload.playbookDetails.triggerStep); });
      $scope.playbookDetails = $scope.triggerStep.description || $scope.payload.playbookDetails.description;
      $scope.playbookTitle = $scope.triggerStep.arguments.title || $scope.payload.playbookDetails.name;
      $scope.playbookName = ($scope.payload.playbookDetails.name).replace(/ /g, '+');
    }
    _init();
  }
})();