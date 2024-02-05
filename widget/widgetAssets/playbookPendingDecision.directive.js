/* Copyright start
  MIT License
  Copyright (c) 2024 Fortinet Inc
  Copyright end */
'use strict';

(function () {
  angular
    .module('cybersponse')
    .directive('playbookPendingDecision', playbookPendingDecision);

  playbookPendingDecision.$inject = ['Field', '$filter', 'picklistsService', 'playbookService', 'toaster', '_', '$interpolate',
    'currentDateMinusService', 'addToCurrentDateService', 'convertToRelativeDateService', 'getRelativeDateService', 'usersService', 'FormEntityService',
    'CommonUtils', 'Entity', '$timeout'];

  function playbookPendingDecision(Field, $filter, picklistsService, playbookService, toaster, _, $interpolate,
    currentDateMinusService, addToCurrentDateService, convertToRelativeDateService, getRelativeDateService, usersService, FormEntityService,
    CommonUtils, Entity, $timeout) {
    var directive = {
      restrict: 'A',
      scope: {
        decisionResponse: '=?',
        modal: '=',
        submitCallback: '=?',
        unauthenticated: '=?'
      },
      controller: 'BaseCtrl',
      templateUrl: 'widgets/installed/playbookExecutionWizard-1.0.0/widgetAssets/playbookPendingDecision.html',
      link: link
    };

    function link(scope) {
      scope.processing = false;
      scope.playbookResumed = false;
      scope.pendingDecisionFormDisabled = false;
      scope.error = '';
      scope.playbookExecutePermission = true;
      scope.playbookReadPermission = true;
      scope.securityUpdatePermission = true;
      //}
      scope.onChange = onChange;
      var entity;
      var inputVariableEntity;
      var currentUser = usersService.getCurrentUser();
      init();

      function init() {
        if (angular.isDefined(scope.decisionResponse) && scope.decisionResponse.type === 'InputBased' && scope.decisionResponse.input.schema.inputVariables.length > 0) {
          /* jshint camelcase: false */
          scope.processing = true;
          var stepDataVariables = scope.decisionResponse.input.schema.inputVariables;
          var moduleField = _.find(stepDataVariables, function (variable) {
            return variable.useRecordFieldDefault || variable.useModuleField;
          });
          if (angular.isDefined(moduleField)) {
            if (angular.isUndefined(entity)) {
              var recordEntity = FormEntityService.get();
              var recordModule = $filter('getModuleName')(scope.decisionResponse.record);
              if (recordEntity && recordEntity.module === recordModule && angular.equals({}, recordEntity.originalData) || !recordEntity) {
                entity = new Entity(recordModule);
                entity.get($filter('getEndPathName')(scope.decisionResponse.record)).then(function () {
                  _prepareVariableData(stepDataVariables);
                });
              } else {
                entity = recordEntity;
                _prepareVariableData(stepDataVariables);
              }
            }
          } else {
            _prepareVariableData(stepDataVariables);
          }
        }
      }

      function _prepareVariableData(stepDataVariables) {
        scope.fieldObject = {};
        var firstField;
        var rows = angular.isDefined(entity) ? [entity.originalData] : [];
        angular.forEach(stepDataVariables, function (inputVariable) {
          var field;
          inputVariable.title = inputVariable.label || $filter('camelCaseToHuman')(inputVariable.name);
          if (inputVariable.useRecordFieldDefault || inputVariable.useModuleField) {
            field = angular.copy(entity.fields[inputVariable.moduleField]);
            if (angular.isUndefined(field)) {
              scope.processing = false;
              scope.error = '<span class="fa fa-exclamation-triangle warning-icon font-size-10"></span> <span class="font-bold font-italic">' + inputVariable.title + ' </span> field not found in ' + entity.descriptions.plural + ' module.';
              return;
            }
            var commonValue = CommonUtils.getCommonValue(rows, field.name);
            field.value = field.type === 'datetime' ? new Date(commonValue * 1000) : commonValue;
            if (angular.isObject(commonValue)) {
              field.value.display = field.getExportValue();
            }
            field.title = inputVariable.title ? inputVariable.title : field.title;
            field.name = inputVariable.name ? inputVariable.name : field.name;
            field.tooltip = inputVariable.tooltip ? inputVariable.tooltip : field.tooltip;
            field.validation = {
              'required': angular.isDefined(inputVariable.required) ? inputVariable.required : true
            };
            field.required = angular.isDefined(inputVariable.required) ? inputVariable.required : true;
            field.buttonClasses = 'btn btn-link';
          } else {
            inputVariable.writeable = true;
            field = new Field(inputVariable);
            field.displayTemplate = decodeURI(inputVariable.displayTemplate);
            field.value = inputVariable.defaultValue;
            field.tooltip = inputVariable.tooltip;
            field.validation = {
              'required': angular.isDefined(inputVariable.required) ? inputVariable.required : true
            };
            field.required = angular.isDefined(inputVariable.required) ? inputVariable.required : true;
            if (field.type.indexOf('datetime') === 0 && field.value) {
              if (angular.isObject(field.value) && field.value.hasOwnProperty('differenceType')) {
                field.value = convertToRelativeDateService(field.value);
              }
              evaluateDateFieldValue(field);
            }
          }
          field.visibility = inputVariable.visibilityQuery && inputVariable.visibilityQuery.filters && inputVariable.visibilityQuery.filters.length > 0 ? inputVariable.visibilityQuery : true;
          if (field.type === 'picklist' || field.type === 'multiselectpicklist') {
            picklistsService.loadPicklists(field);
          }
          if (!firstField) {
            firstField = field;
          }
          scope.fieldObject[field.name] = field;
        });
        if (scope.error === '') {
          scope.focusOnField(firstField.name, 250);
        }
        inputVariableEntity = new Entity('inputVariables');
        inputVariableEntity.fields = scope.fieldObject;
        inputVariableEntity.evaluateAllFields();
        scope.processing = false;
      }

      function evaluateDateFieldValue(field) {
        if (angular.isString(field.value) && (field.value.indexOf('currentDateMinus') !== -1 || field.value.indexOf('addToCurrentDate') !== -1 || field.value.indexOf('getRelativeDate') !== -1)) {
          var valueTemplate = '{{' + field.value + '}}';
          field.value = JSON.parse($interpolate(valueTemplate)({
            currentDateMinus: currentDateMinusService,
            addToCurrentDate: addToCurrentDateService,
            getRelativeDate: getRelativeDateService
          }));
        }
      }

      scope.submitDecision = function (selectedStep) {
        if (scope.pendingDecisionForm.$invalid) {
          scope.pendingDecisionForm.$setTouched();
          scope.pendingDecisionForm.$focusOnFirstError();
          return;
        }
        scope.processing = true;
        /* jshint camelcase: false */
        var payload = {
          input: {},
          step_iri: selectedStep.step_iri,
          step_id: scope.decisionResponse.step_id,
          manual_input_id: scope.decisionResponse.id
        };
        if (!scope.unauthenticated) {
          payload.user = currentUser['@id'];
        }
        angular.forEach(_.values(scope.fieldObject), function (field) {
          payload.input[field.name] = field.value;
        });

        playbookService.resumeAwaitingPlaybook(payload, scope.decisionResponse.workflow).then(function (data) {
          toaster.success({
            body: data.message
          });
          if (scope.submitCallback && typeof scope.submitCallback === 'function') {
            scope.submitCallback();
          }
        }, function (error) {
          toaster.error({
            body: error.data.message
          });
        }).finally(function () {
          scope.processing = false;
          if (scope.modal) {
            scope.close('resumed');
          } else {
            scope.pendingDecisionFormDisabled = true;
          }
          scope.disabledField = scope.pendingDecisionFormDisabled || scope.processing;
        });
      };

      function onChange(value, field) {
        var isObjectExpand = angular.isObject(value) && field.value === value['@id'];
        if (value && !isObjectExpand) {
          field.acceptChange = true;
        }
        if (inputVariableEntity && inputVariableEntity.fields) {
          $timeout(function () {
            inputVariableEntity.evaluateAllFields();
          }, 200);
        }
      }
    }
    return directive;
  }
})();