/* Copyright start
  MIT License
  Copyright (c) 2024 Fortinet Inc
  Copyright end */
'use strict';
(function () {
    angular
        .module('cybersponse')
        .controller('editPlaybookExecutionWizard100Ctrl', editPlaybookExecutionWizard100Ctrl);

    editPlaybookExecutionWizard100Ctrl.$inject = ['$scope', '$uibModalInstance', 'config'];

    function editPlaybookExecutionWizard100Ctrl($scope, $uibModalInstance, config) {
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
