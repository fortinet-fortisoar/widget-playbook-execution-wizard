'use strict';
(function () {
    angular
        .module('cybersponse')
        .controller('editImportWizard100DevCtrl', editImportWizard100DevCtrl);

    editImportWizard100DevCtrl.$inject = ['$scope', '$uibModalInstance', 'config'];

    function editImportWizard100DevCtrl($scope, $uibModalInstance, config) {
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
