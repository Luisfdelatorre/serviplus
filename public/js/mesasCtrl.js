app.controller('mesasCtrl', ['$rootScope', '$scope', 'CONFIG', 'authFactory', 'mesasFactory', 'store', '$location', 'md5', 'svcpedidos','svc', 'svclogin','$timeout', function($rootScope, $scope, CONFIG, authFactory, mesasFactory, store, $location, md5, svcpedidos, svc, svclogin,$timeout) {



$scope.doLogout = function() {
	$rootScope.slogin = false;
	localStorage.removeItem('token');
	$location.path("login");
	$rootScope.reloadt=true;
	$timeout(function() {
      $rootScope.reloadt=false;
					
            }, 1500);
	
 }
      $scope.getmesas = function() {

            var token = localStorage.getItem('token');
            authFactory.gmesas(token).then(function(res) {
                if (res.data && res.data.code == 0) {
                    $rootScope.mesas = res.data.response.mesas;
              }
            });

        }
	$scope.setgrupo=  function(grupo) {
	  $rootScope.mesag=grupo.m;
		
		 angular.forEach($rootScope.grupos, function(grupo) {
            grupo.selec = false;
        });
        grupo.selec = true;
	}
	  
$scope.clickkey = function(key){
	svclogin.clickkey(key,'') 
}
$scope.clickperkey = function(key){
	$rootScope.currentmesa.GN=key;
	$rootScope.currentmesa.active=true;
	$rootScope.submit=false;
	$rootScope.keylog=true;
	$rootScope.perkeylog=false;
	$rootScope.titulo=$rootScope.titulo+' : '+$rootScope.currentmesa.GN;
	$location.path("/product");
}
    if ($rootScope.slogin && !$rootScope.init) {
		var visor=localStorage.getItem('visor');
		if(visor=='true'){
			//$location.path("/visor");
			//document.getElementById('audiotag1').play();
			//$rootScope.submit=0;
			svcpedidos.getordenes();
		}else{
			
	if ($rootScope.ipready){
            svc.getmesas();
            svc.getcategorias();
	
		}else{
				
		$timeout(function() {
              svc.getmesas();
            svc.getcategorias();
					
            }, 1000);
			}
		}
		   $rootScope.submit = 1;
        }
   $scope.setmesa = function(mesa) {
	   		$rootScope.currentmesa=mesa;
			$rootScope.categorias.visible = 1;
            $rootScope.titulo = 'Mesa ' + mesa.N;
            if ($rootScope.titulo.length > 16) {
                $rootScope.titulo = $rootScope.titulo.substr(0, 16) + '...';
            }
            $rootScope.productos = $rootScope.categoriasindex[$rootScope.firtcat].product;
			$rootScope.productostemp = $rootScope.categoriasindex[$rootScope.firtcat].product;
        	if(mesa.active){
				
				$rootScope.titulo=  mesa.N+' : '+mesa.GN;
				$location.path("/product");
				
			}	else{
				$rootScope.submit=true;
	   			$rootScope.keylog=false;
				$rootScope.perkeylog=true;
				
			}
	 
            // $rootScope.mesaidinput = j;
	   	
            //

        }
   
   $scope.cancelmesa =function(){
	   
	   $rootScope.submit=false;
	   $rootScope.keylog=true;
		$rootScope.perkeylog=false;
   }

     

    }])
    .factory("mesasFactory", ["$http", "$q", 'store', "CONFIG", function($http, $q, store, CONFIG) {
        var mesasFactory = {};


        mesasFactory.delegation = function(token) {

            var deferred;
            deferred = $q.defer();
            $http({
                    method: 'POST',
                    skipAuthorization: true,
                    url: CONFIG.APIURL + '/auth/delegation',
                    data: "refresh_token=" + token,
                    headers: {
                        'Content-Type': 'application/x-www-form-urlencoded'
                    }
                })
                .then(function(res) {
                    deferred.resolve(res);
                })
                .then(function(error) {
                    deferred.reject(error);
                })
            return deferred.promise;
        };

        return mesasFactory;
    }]);