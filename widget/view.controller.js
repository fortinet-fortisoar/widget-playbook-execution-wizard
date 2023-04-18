'use strict';
(function () {
  angular
    .module('cybersponse')
    .controller('importWizard100DevCtrl', importWizard100DevCtrl);

  importWizard100DevCtrl.$inject = ['$scope', '$q', 'WizardHandler', '$resource', 'API', 'playbookService', '$uibModal', '_', 'Entity', '$filter', 'websocketService', '$http'];

  function importWizard100DevCtrl($scope, $q, WizardHandler, $resource, API, playbookService, $uibModal, _, Entity, $filter, websocketService, $http) {
    $scope.showDataWizard = false;
    $scope.close = close;
    $scope.moveNext = moveNext;
    $scope.moveFinishNext = moveFinishNext;
    $scope.movePrevious = movePrevious;
    $scope.executeGridPlaybook = executeGridPlaybook;
    $scope.playbookDetails = '';
    //$scope.playbookTitle = ''; 
    $scope.playbookDescription = '';
    $scope.triggerStep = {};
    $scope.taskId = undefined;
    initWebsocket();
    $scope.$on('websocket:reconnect',function(){
      initWebsocket();
    });
    var subscription;
    function initWebsocket(){
      websocketService.subscribe('runningworkflow',function(data){
        //do nothing in case of notification recieved from same websocketSession. As it is handled gracefully.
        if(data.sourceWebsocketId !== websocketService.getWebsocketSessionId()){
          if($scope.taskId && data.task_id && data.task_id === $scope.taskId && data.parent_wf === 'null'){
            angular.element(document.querySelector("[name='solutionpackWizard']").querySelector("[data-ng-controller='RunningPlaybookCtl']")).scope().params.srchBox = data.instance_ids;
            document.querySelector("[name='solutionpackWizard']").getElementsByClassName("executed-pb-filter-container")[0].style.display = 'none';
            $scope.$broadcast('cs:getList');
            WizardHandler.wizard('solutionpackWizard').next();
            $scope.taskId = undefined;
          }
        }
        if(data.status=='finished'){
          $scope.playbookInstanceIds = data;
        }
      }).then(function(data){
        subscription = data;
      });
    }

    $scope.$on('$destroy', function() {
      if(subscription){
        // Unsubscribe
        websocketService.unsubscribe(subscription);
      }
    });

    function close() {
      $scope.$parent.$parent.$parent.$ctrl.handleClose();
    }

    // moveVersionControlNext() {
    //  WizardHandler.wizard('solutionpackWizard').next();
    //}

    function movePrevious() {
      WizardHandler.wizard('solutionpackWizard').previous();
    }

    function moveFinishNext() {
      WizardHandler.wizard('solutionpackWizard').next();
      getPlaybookResult();
    }

    function moveNext() {
      executeGridPlaybook($scope.config.metadata.playbook, $scope.triggerStep);
    }

    function executeGridPlaybook(playbook, triggerStep) {
      var deferred = $q.defer();
      $resource(API.BASE + API.WORKFLOWS + playbook.uuid).get({ '$relationships': true }).$promise.then(function (playbook) {
        //var triggerStep = playbookService.getTriggerStep(playbook);
        
        var entity = new Entity(triggerStep.arguments.resources[0]);
        entity.loadFields().then(function () {
          if (triggerStep.arguments.inputVariables && triggerStep.arguments.inputVariables.length > 0) {
            var modalInstance = $uibModal.open({
              templateUrl: 'app/components/modals/inputVariables.html',
              controller: 'InputVariablesCtrl',
              backdrop: 'static',
              resolve: {
                playbook: playbook,
                entity: angular.copy(entity),
                rows: function () {
                  var rows = $scope.config.metadata.getSelectedRows;
                  return rows;
                }
              }
            });
            modalInstance.result.then(function (result) {
              triggerPlaybookWithRecords(playbook, triggerStep.arguments.resources[0], $scope.config.metadata.getSelectedRows, result).then(function (workflowID) {
                deferred.resolve();
              });
            });
          } else {
            triggerPlaybookWithRecords(playbook, triggerStep.arguments.resources[0], $scope.config.metadata.getSelectedRows, { inputVariables: {} }).then(function (workflowID) {
              deferred.resolve();
            });
          }
        });
      });
      return deferred.promise
    }

    function triggerPlaybookWithRecords(playbook, module, selectedRows, manualTriggerInput) {
      var apiNoTrigger = API.MANUAL_TRIGGER + playbook.uuid;
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
      });
    }
    
    function getPlaybookResult(){
      var endpoint = '/api/wf/api/workflows/'+$scope.playbookInstanceIds.instance_ids+'/';
      $http.get(endpoint).then(function (response) {
         $scope.playbookResult = response.data.result;
      }); 
    }
    function _init() {
      $scope.triggerStep = _.find($scope.config.metadata.playbook.steps, function (item) { return item.uuid === $filter('getEndPathName')($scope.config.metadata.playbook.triggerStep);});
        //var triggerStep = playbookService.getTriggerStep($scope.config.metadata.playbook);
      console.log($scope.triggerStep);
      $scope.playbookDetails = $scope.triggerStep.description || $scope.config.metadata.playbook.description;
      $scope.playbookTitle = $scope.triggerStep.arguments. title || $scope.config.metadata.playbook.name
    }
    _init();
  }
})();