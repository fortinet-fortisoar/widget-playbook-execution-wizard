/* Copyright start
  MIT License
  Copyright (c) 2025 Fortinet Inc
  Copyright end */
'use strict';
(function () {
    angular
        .module('cybersponse')
        .controller('editPlaybookExecutionWizard101Ctrl', editPlaybookExecutionWizard101Ctrl);

    editPlaybookExecutionWizard101Ctrl.$inject = ['$scope', '$uibModalInstance', 'config'];

    function editPlaybookExecutionWizard101Ctrl($scope, $uibModalInstance, config) {
        $scope.cancel = cancel;
        $scope.save = save;
        $scope.config = config;

        function cancel() {
            $uibModalInstance.dismiss('cancel');
        }

        function save() {
            $uibModalInstance.close($scope.config);
        }

    }
})();
