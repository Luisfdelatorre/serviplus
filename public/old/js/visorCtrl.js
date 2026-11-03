app.controller('visorCtrl', ['$rootScope', '$scope', 'CONFIG',  'store', '$location', 'jwtHelper','svcpedidos', function($rootScope, $scope, CONFIG, store, $location, jwtHelper,svcpedidos) {

			$rootScope.visorvalue=1;
			$scope.visorcolor=$rootScope.visorvalue;
		svcpedidos.updateordenes();
		svcpedidos.getordenes();
		svcpedidos.updateposition();
	$scope.readyorder=function() {
		
		$rootScope.visorvalue=2;
		$scope.visorcolor=$rootScope.visorvalue;
		
	}
	
	$scope.prepaorder=function() {
		
		$rootScope.visorvalue=1;
		$scope.visorcolor=$rootScope.visorvalue;
		
	}


}]).service('svcpedidos', ['$rootScope',  '$timeout', '$location', 'jwtHelper', '$interval','authFactory','pedidosFactory','$window', function($rootScope, $timeout, $location, jwtHelper, $interval,authFactory,pedidosFactory,$window) {
    var svcpedidos = {};
	
	
	svcpedidos.getordenes = function() {
		
		  $interval(function() {svcpedidos.updateordenes(); }, 5000);
		
	}

    svcpedidos.updateordenes = function() {
        $rootScope.ordenest = function() {
           	var token = localStorage.getItem('token');
			var totalep=0;
	         pedidosFactory.getordenes(token,$rootScope.idlast).then(function(res) {
                if (res.data && res.data.code == 0) {
						angular.forEach(res.data.response.ordenesin, function(orden,i) {
							if(orden){
								$rootScope.idlast=orden.oid;
							}
						});
					if ($rootScope.ordenupdate==undefined){
						$rootScope.ordenupdate=res.data.response.ordenesin;
						
						angular.forEach($rootScope.ordenupdate, function(orden,i) {
									totalep=0;
						angular.forEach(orden.items, function(item,i) {
									item.delay=item.Ct;
									totalep+=item.EP;
								});
								orden.T=totalep;
							
							
							
							});
								
					}else{
						angular.forEach(res.data.response.ordenesin, function(orden,i) {
							
							if(!$rootScope.ordenupdate[orden.oid]){
								$rootScope.ordenupdate[orden.oid]=orden;
								document.getElementById('audiotag1').play();
							}
						});
						angular.forEach(res.data.response.ordenesout, function(val,i) {
							if($rootScope.ordenupdate[val.id].St==1){
								
								$rootScope.ordenupdate[val.id].St=2;
								$rootScope.ordenupdate[val.id].Lt=val.Lt;
								totalep=0;
								angular.forEach($rootScope.ordenupdate[id].items, function(item,i) {
									item.delay=item.Ct;
									totalep+=item.EP;
								});
								orden.T=totalep;
							}	
							
							
						});
						angular.forEach(res.data.response.ordenesreplace, function(orden,i) {
						
										totalep=0;
						angular.forEach(orden.items, function(item,i) {
							
							
							if($rootScope.ordenupdate[orden.oid].items[i]==undefined)
								$rootScope.ordenupdate[orden.oid].items[i]=[];
							
							
					$rootScope.ordenupdate[orden.oid].items[i].Ct=item.Ct;
					$rootScope.ordenupdate[orden.oid].items[i].MIT=item.MIT;
					$rootScope.ordenupdate[orden.oid].items[i].Q=item.Q;
					$rootScope.ordenupdate[orden.oid].items[i].EP=item.EP;	
							
							totalep+=item.EP;
								});
						$rootScope.ordenupdate[orden.oid].T=totalep;
							
							
							
							
						});
						
						
						
						
						
					}
				  } else {

				}
            });
        }

        var token = localStorage.getItem('token');
        if (token !== null) {
            var bool = jwtHelper.isTokenExpired(token);
            if (bool === true) {
                var refreshToken = localStorage.getItem('refresh_token');
                if (refreshToken !== null) {
                    authFactory.delegation(refreshToken).then(function(res) {
                        if (res.data && res.data.code == 0) {
                            localStorage.setItem('token', res.data.response.token);
                            localStorage.setItem('refresh_token', res.data.response.refresh_token);

                            $rootScope.slogin = true;
                            $rootScope.ordenest();
                        } else {
                            $rootScope.ordenest();
                        }
                    }, function() {
                        $rootScope.ordenest();
                    });
                } else {
                    $rootScope.ordenest();
                }
            } else {
                $rootScope.slogin = true;
                $rootScope.ordenest();
            }
        } else {
            $rootScope.slogin = true;
            $rootScope.ordenest();
        }
    }
	
	
	 svcpedidos.ordenesposition=function() {
		  var alturapage=$window.innerHeight || 800;
		 	var acum = 0;
        	var colum = 0;
        	var porcent = 19.8; 
		 var acumant;
		 var altura;
		 $rootScope.newordenes=[];
		 angular.forEach($rootScope.ordenupdate, function(orden,i) {
			 
			 $rootScope.newordenes.push(orden);
		 });
		 if($rootScope.visorvalue=='2')
		 $rootScope.newordenes.reverse();
		 
		 angular.forEach($rootScope.newordenes, function(orden,i) {
			  if(orden.St==$rootScope.visorvalue){
                altura = ($rootScope.posi && $rootScope.posi[orden.oid]) ? $rootScope.posi[orden.oid] : 180;
			 	if (altura > 0) {
				    altura += 5;
                    acumant = acum;
                    acum += altura;
                    if (acum+40 > alturapage ) {
                        acumant = 0;
                        acum = altura;
                        colum += 1;
                    }
				    var posleft = colum * porcent;
					//console.log('i '+i );
                    orden.top=acumant + 'px';
                    orden.left=posleft + '%';
					var d = new Date();
					var ch = d.getHours();
					var cm = d.getMinutes();
					var cs = d.getSeconds();
					var hms = orden.t.split(':');
					var h=parseInt(hms[0]);
					var m=parseInt(hms[1]);
					var hms2=hms[2].split(' ');
					var s=parseInt(hms2[0]);
					if (hms2[1]=='PM')
						h+=12;
					dh=(h*60+m)-(ch*60+cm);
					orden.delay=dh;
					
					angular.forEach(orden.items, function(item,i) {
						
						if(orden.St==1){
					if(orden.delay+item.Ct>0)
						if(s-cs>=0)
							item.delay=(orden.delay+item.Ct)+':'+addZero(s-cs);
						else
							item.delay=(orden.delay+item.Ct-1)+':'+addZero(60+s-cs);
							
					else
						item.delay=(orden.delay+item.Ct);
					
						if(orden.delay+item.Ct<5){
							
							orden.flash=true;
						}
							
						$rootScope.visorvalue
						if($rootScope.visorvalue==2){
							
							orden.flash=false;
						}
						
						}else{
							
							orden.flash=false;
						}
						
						
						});
					
					
					
					
					
					function addZero(i) {
						if (i < 10) {
							i = "0" + i;
						}
						return i;
					}

                }
		 }
            });
						 
					
	
	 }
	
	svcpedidos.updateposition=function(){
	$interval(function() {
					 svcpedidos.ordenesposition();
                },1000);
}
	
	
	
	


    return svcpedidos;
}])


.factory("pedidosFactory", ["$http", "$q", 'store', "CONFIG", function($http, $q, store, CONFIG) {
    var pedidos = {};

   pedidos.getordenes = function(token,idlast) {
        var deferred;
        deferred = $q.defer();
        $http({
                method: 'POST',
                skipAuthorization: true,
                url: CONFIG.APIURL + '/home/visor',
                data: "atoken=" + token+'&last='+idlast,
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

    return pedidos;
}]);