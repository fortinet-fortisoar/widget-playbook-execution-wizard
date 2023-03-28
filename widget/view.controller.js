'use strict';
(function () {
  angular
    .module('cybersponse')
    .controller('playbookExecutionWizard100Ctrl', playbookExecutionWizard100Ctrl);

  playbookExecutionWizard100Ctrl.$inject = ['$scope', '$q', 'WizardHandler', '$resource', 'API', 'playbookService', '$uibModal', '_', 'Entity', '$timeout'];

  function playbookExecutionWizard100Ctrl($scope, $q, WizardHandler, $resource, API, playbookService, $uibModal, _, Entity, $timeout) {
    $scope.showDataWizard = false;
    $scope.close = close;
    $scope.moveNext = moveNext;
    $scope.moveFinishNext = moveFinishNext;
    $scope.movePrevious = movePrevious;
    $scope.executeGridPlaybook = executeGridPlaybook;
    $scope.playbookDetails = '';
    $scope.playbookName = $scope.config.metadata.playbook.name;
    $scope.playbookDescription = $scope.config.metadata.playbook.description;


    $scope.$on('playbookActions:triggerCompleted', function () {
      $scope.$broadcast('cs:getList');
      WizardHandler.wizard('solutionpackWizard').next();
    });

    function close() {
      $scope.$parent.$parent.$parent.$ctrl.handleClose();
    }

    function moveVersionControlNext() {
      WizardHandler.wizard('solutionpackWizard').next();
    }

    function movePrevious() {
      WizardHandler.wizard('solutionpackWizard').previous();
    }

    function moveFinishNext() {
      WizardHandler.wizard('solutionpackWizard').next();
    }

    function moveNext() {
      executeGridPlaybook($scope.config.metadata.playbook).then(function () {
        $scope.$broadcast('cs:getList');
        WizardHandler.wizard('solutionpackWizard').next();
      })
    }

    function returnSelectedRows() {
      return $scope.config.metadata.getSelectedRows;
    }

    function executeGridPlaybook(playbook) {
      var deferred = $q.defer();
      $resource(API.BASE + API.WORKFLOWS + playbook.uuid).get({ '$relationships': true }).$promise.then(function (playbook) {
        var triggerStep = playbookService.getTriggerStep(playbook);
        $scope.playbookDetails = triggerStep.description;
        var entity = new Entity(triggerStep.arguments.resources[0]);
        entity.loadFields().then(function () {
          if ($scope.config.metadata.getSelectedRows.length > 0) {
            if (triggerStep.arguments.inputVariables && triggerStep.arguments.inputVariables.length > 0) {
              var modalInstance = $uibModal.open({
                templateUrl: 'app/components/modals/inputVariables.html',
                controller: 'InputVariablesCtrl',
                backdrop: 'static',
                resolve: {
                  playbook: playbook,
                  entity: angular.copy(entity),
                  rows: function () {
                    var rows = returnSelectedRows();
                    return rows;
                  }
                }
              });
              modalInstance.result.then(function (result) {
                triggerPlaybookWithRecords(playbook, triggerStep.arguments.resources[0], $scope.config.metadata.getSelectedRows, result).then(function () {
                  deferred.resolve();
                });
              });
            } else {
              triggerPlaybookWithRecords(playbook, triggerStep.arguments.resources[0], $scope.config.metadata.getSelectedRows, { inputVariables: {} }).then(function () {
                deferred.resolve();
              });
            }
          } else {
            playbookService.triggerPlaybookAction(playbook, returnSelectedRows, $scope, true, entity);
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
      return $resource(apiNoTrigger).save(env).$promise;
    }

    function _init() {
    }
    _init();
  }
})();