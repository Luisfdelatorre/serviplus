var app = angular.module('ServiPlus', [
    'ngRoute',
    'angular-jwt',
    'angular-storage',
    'mobile-angular-ui',

]);
var detectedHost = (typeof window !== 'undefined' && window.location && window.location.protocol.indexOf('http') === 0 && window.location.host) 
    ? (window.location.protocol + '//' + window.location.host)
    : "http://192.168.1.150";

app.constant('CONFIG', {
        APIURL: detectedHost,
	    APIURLBASE: "192.168.1.",
	    MAXIP: "254",
    })
    .config(["$routeProvider", "$httpProvider", "jwtInterceptorProvider", function($routeProvider, $httpProvider, jwtInterceptorProvider) {
       $httpProvider.defaults.headers.common["X-Requested-With"] = 'XMLHttpRequest';
        jwtInterceptorProvider.tokenGetter = ['$http', 'jwtHelper', 'authFactory', '$rootScope', '$location', function($http, jwtHelper, authFactory, $rootScope, $location) {
		
            var token = localStorage.getItem('token');
            if (token !== null) {
                var bool = jwtHelper.isTokenExpired(token);
				//alert(bool);
                if (bool === true) {
                    var refreshToken = localStorage.getItem('refresh_token');
                    if (refreshToken !== null && !$rootScope.delegation) {
                        $rootScope.delegation = true;
                        authFactory.delegation(refreshToken).then(function(res) {
                            $rootScope.delegation = false;
                            if (res.data && res.data.code == 0) {
                                localStorage.setItem('token', res.data.response.token);
                                localStorage.setItem('refresh_token', res.data.response.refresh_token);
                               // $location.path("/mesas");
                                $rootScope.slogin = true;
                            }else{
								
								$rootScope.slogin = false;
								localStorage.removeItem('token');
								$location.path("login");}
								//$rootScope.reloadt=true;
                        });
                    }
                }else{
                    $rootScope.slogin = true;
                }
            }
            return token;
        }];
        $httpProvider.interceptors.push('jwtInterceptor');
        $httpProvider.interceptors.push(["$q", "$rootScope", function($q, $rootScope) {
            return {
                responseError: function(rejection) {
			
					$rootScope.verificar(rejection);
                     return $q.reject(rejection);
                }
            };
        }]);


     
        $routeProvider.when('/mesas', {
            templateUrl: 'template/mesas.html',
            reloadOnSearch: false,
            controller: 'mesasCtrl'
        });
        $routeProvider.when('/', {
            templateUrl: 'template/mesas.html',
            reloadOnSearch: false,
            controller: 'mesasCtrl'
        });
        $routeProvider.when('/product', {
            templateUrl: 'template/productos.html',
            reloadOnSearch: false,
            controller: 'productCtrl'
        });
        $routeProvider.when('/login', {
            templateUrl: 'template/login.html',
            reloadOnSearch: false,
            controller: 'loginCtrl'
        });
        $routeProvider.when('/visor', {
            templateUrl: 'template/visor.html',
            reloadOnSearch: false,
            controller: 'visorCtrl'
        });
   
     

    }])
    .run(["$rootScope", 'jwtHelper', 'store', 'authFactory', '$location', function($rootScope, jwtHelper, store, authFactory, $location) {
        $rootScope.$on('unauthenticated', function(event, data) {
            //$location.path("/login");
        });
        $rootScope.$on('$routeChangeStart', function(event, next, current) {
            var targetPath = (next && next.$$route && next.$$route.originalPath) || $location.path();
            if (targetPath === '/visor') {
                $rootScope.slogin = true;
                return;
            }
            var token = localStorage.getItem('token');
            if (token !== null) {
                var bool = jwtHelper.isTokenExpired(token);
                if (bool === true) {
                     $location.path("/login");
                } else {
                     $rootScope.slogin = true;
                }
            } else {
                $location.path("/login");
            }

        });
        $rootScope.$on('$routeChangeSuccess', function() {
            // $rootScope.loading = false;
        });
    }])
    .controller('load', ["$rootScope", '$location', '$scope', '$timeout','authFactory','svclogin','CONFIG', function($rootScope, $location, $scope, $timeout,authFactory,svclogin,CONFIG) {
   
        $rootScope.keys = [];
		$rootScope.numkey=[];
        $rootScope.conectview = false;
        $rootScope.clave='';
        $rootScope.reloadt = 0;
        $rootScope.mtitulo='ServiPlus';
        $rootScope.titulo=$rootScope.mtitulo;
        $rootScope.categorias=[];
        $rootScope.circle=['circle','circle','circle','circle'];
		$rootScope.init=0;
		$rootScope.excuterip=1;
		$rootScope.red = false;
		$rootScope.keylog=true;
		$rootScope.perkeylog=false;
		$rootScope.notasmodi=[];
		$rootScope.posi={};
		$rootScope.idlast=0;
		//$rootScope.ordenupdate=[];
		$scope.getip= function() {
			$rootScope.mensaje = 'Verificando conexión';
			var  serverip = localStorage.getItem('serverip');
			 svclogin.getip(serverip);
		  
        }
      
    for (var j = 1; j <=20; j++) {
			$rootScope.numkey.push(j);
			}
     for (var j = 1; j <=9; j++) {
			$rootScope.keys.push({id:j,value:j});
			}
        $rootScope.keys.push({id:11,value:'C'});
        $rootScope.keys.push({id:10,value:'0'});
        $rootScope.keys.push({id:12,value:'<'});
	    $rootScope.verificar = function(r) {
            // Ignorar fallos de sondeo durante el descubrimiento automático de servidor
            if (r && r.config && r.config.data && (r.config.data.indexOf('quick') > -1 || r.config.data.indexOf('discovery') > -1)) {
                return;
            }
            $rootScope.conect = 'connect-show';
            $rootScope.conectview = true;
			$rootScope.excuterip++;
		if (r && r.config && r.config.data && r.config.data.search('count')>0){
			console.log($rootScope.excuterip);
			if ($rootScope.excuterip >= 25){
				$rootScope.getipval = true;
	   			$rootScope.submit = true;
				$rootScope.excuterip=0;
			   	$rootScope.testiptimer=false;
				$rootScope.conectview = true;
			}
		}
			
			if (r.config.data.search('base')>0){
				 var serverip = localStorage.getItem('serverip');
				authFactory.ping(CONFIG.APIURL,'test').then(function(res) {
				   if (res.data && res.data.code == 0) {
					   	 CONFIG.APIURL='http://'+serverip;
					}
				   
				   
			   });
				
			}
			
			if (r.config.data.search('test')>0){
			
				svclogin.getip(null);
				
			}
			
				if (r.config.data.search('setip')>0){
				//console.log(JSON.stringify(r));
				//svclogin.getip(null);
			
				$rootScope.errorip=true;
					
					$timeout(function() {
                $rootScope.testiptimer=false;
            }, 1600);
				
			}
			
			
			
						
            $timeout(function() {
                $rootScope.reloadt = 0;
            }, 1600);


            $timeout(function() {
                $rootScope.conect = 'connect-hide';

                $timeout(function() {
                    $rootScope.conectview = false;
                }, 250);
            }, 2000);

        }
        var initialHash = window.location.hash || '';
        if (initialHash.indexOf('visor') > -1) {
            $rootScope.slogin = true;
            $location.path("/visor");
        } else {
            var token = localStorage.getItem('token');
            if (token !== null) {
               $location.path("/mesas");
                $rootScope.slogin = true;
            } else {
                $location.path("/login");
                $rootScope.slogin = false;
            }
        }
		$scope.getip();	
 $scope.sections = [{"Name":"Section 1", "SectionId":"Id1", "Items":["Item 1", "Item 2"]},{"Name":"Section 2", "SectionId":"Id2", "Items":["Item 3", "Item 4"]}];


    }]);





app.run(function($window, $rootScope, $timeout) {
    $rootScope.online = navigator.onLine;
    $window.addEventListener("offline", function() {
        $rootScope.$apply(function() {
            $rootScope.mensaje = 'Sin conexión de internet';
            $rootScope.conect = 'connect-show';
            $rootScope.conectview = true;
        });
    }, false);

    $window.addEventListener("online", function() {
        $rootScope.$apply(function() {
            $timeout(function() {
                $rootScope.conect = 'connect-hide';

                $timeout(function() {
                    $rootScope.conectview = false;
                }, 250);
            }, 2000);

        });
    }, false);
}).directive('visororder', ['$rootScope','$timeout', function ($rootScope,$timeout) {
    return {
        restrict: 'C',
        scope: {
            id: '@'
        },
        link: function ($scope, element, attrs) {
                 
			$scope.$watch( function() {
                $rootScope.posi[$scope.id]=element[0].offsetHeight;
            } );
			
			
        }
    }
}]);