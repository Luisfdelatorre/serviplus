app.controller('productCtrl', ['$rootScope', '$scope', 'CONFIG', 'authFactory', 'mesasFactory', 'svc', 'store', '$location', 'jwtHelper', function($rootScope, $scope, CONFIG, authFactory, mesasFactory, svc, store, $location, jwtHelper) {

    $rootScope.productlist = {
        'p': [],
        'h': []
    };
    $rootScope.type = 0;
    $rootScope.enviado = false;
    $rootScope.mensaje = 'Enviado';
    $rootScope.totalorden = 0;
    $rootScope.categorias[0].selec = true;
    $scope.comment = '';

    $scope.addproduct = function(produc, id) {
        if ($rootScope.type == 1) {

            produc.selec = !produc.selec;

        } else {

            if (produc.MIT == 2) {
                $rootScope.productostemp = $rootScope.productos;
                $rootScope.productos = produc.subproduct;
                $rootScope.productos.id = 'superior';
                $rootScope.subpro = 1;

            } else {



                if (produc.modifi.length > 0) {
                    $rootScope.productostemp = $rootScope.productos;
                    $rootScope.productos = produc.modifi;
                    $rootScope.productos.id = id;
                    //$rootScope.productos.index=id;  
                    $rootScope.type = 1;

                } else {
                    // console.log(JSON.stringify(produc)); 
                    $rootScope.productlist.p.push({
                        // 'product': produc,
                        'id': produc.id,
                        'cant': 1,
                        'N': produc.N,
                        'P': produc.P,
                        'EP': produc.P,
						'MINI':produc.MINI,
						'SDS':produc.SDS,
                        'coment': '',
                        'modifi': [],
                        'notas': []
                    });
                    //$rootScope.productos = $rootScope.productostemp;
                    $scope.total();
                    //$rootScope.subpro = 1;

                }
            }

        }
    }

    $scope.setmodificadores = function() {
        var pid = $rootScope.productos.id;

        if (pid == 'superior') {
            $rootScope.enviado = false;
            $rootScope.subpro = 0;
        } else {
            var produc = $rootScope.productostemp[pid];
            var nombre = produc.N;
            var precio = 0;
            precio = produc.P;
            var list = [];
            angular.forEach($rootScope.productos, function(modifi) {
                if (modifi.selec == true) {
                    if (modifi.P != null)
                        precio = precio * 1 + modifi.P * 1;
                    list.push(modifi);
                }
				
                // modifi.selec = false;
            });
            $rootScope.productlist.p.push({
                //  'product': produc,
                  'id': produc.id,
                        'cant': 1,
                        'N': produc.N,
                        'P': produc.P,
                        'EP': precio ,
						'MINI':produc.MINI,
						'SDS':produc.SDS,
                        'coment': '',
                        'modifi': list,
                        'notas': []
            });
            $rootScope.type = 0;
            angular.forEach($rootScope.productos, function(modifi) {
                modifi.selec = false;
            });

            $scope.total();
            $rootScope.enviado = false;
        }
		$rootScope.productos = $rootScope.productostemp;
    }

    $scope.setnotas = function() {

        var index = $rootScope.prodlistid;
        $rootScope.productlist.p[index].notas = [];
        angular.forEach($rootScope.notasmodi, function(modifi) {
            if (modifi.selec == true) {
                $rootScope.productlist.p[index].notas.push(modifi);
            }

        });
        $rootScope.productlist.p[index].coment = '>'+$scope.comment;
        $scope.comment = '';
        $rootScope.notas = false;
        $rootScope.submit = false;
    }

    $scope.selectnota = function(nota) {
        nota.selec = !nota.selec;
    }
    $scope.cancelnotas = function() {
        angular.forEach($rootScope.notasmodi, function(nota) {
            nota.selec = false;
        });
        $rootScope.notas = false;
        $rootScope.submit = false;
    }

    $scope.pedido = function() {
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
                            svc.sendpedido();
                            //$rootScope.mesainput
                            //svc.mesastat();  
                        } else {


                            $rootScope.slogin = false;
                            $location.path("/login");
                        }
                    });
                } else {
                    $rootScope.slogin = false;
                    $location.path("/login");
                }
            } else {
                svc.sendpedido();
                //svc.mesastat();
            }
        } else {
            $rootScope.slogin = false;
            $location.path("/login");
        }
    }

    $scope.total = function() {
        var total = 0;
        angular.forEach($rootScope.productlist.p, function(product) {
            total = total + product.EP * 1;

        });
		$rootScope.totalorden = total;

    }
    $scope.mas = function(produc) {
        produc.cant = produc.cant * 1 + 1;
        $scope.total();
    }

    $scope.setproduct = function(cat) {
		$rootScope.subpro = 0;
        svc.setproduct(cat);
    }
    $scope.cancelar = function(c) {
        if (c == 'm') {
            $rootScope.type = 0;
            angular.forEach($rootScope.productos, function(modifi) {
                modifi.selec = false;
            });
            $rootScope.productos = $rootScope.productostemp;
            $rootScope.enviado = false;

        } else {
            $rootScope.productlist.p = [];
            $scope.total();

        }
    }

    $scope.menos = function(produc, index) {
        if (produc.cant > 0) {
            produc.cant = produc.cant * 1 - 1;
            if (produc.cant == 0) {
                $rootScope.productlist.p.splice(index, 1);
            }
        }
        $scope.total();
    }
    $scope.editar = function(produc, index) {
        $rootScope.notas = true;
        $rootScope.submit = true;
        $rootScope.prodlistid = index;
		 angular.forEach($rootScope.notasmodi, function(modifi) {
            modifi.selec =false;

        });
		
		
    }

    $scope.gomesas = function() {
        $rootScope.titulo = $rootScope.mtitulo;
        angular.forEach($rootScope.categorias, function(cate) {

            cate.selec = false;
        });
        $location.path("/mesas");
    }

}]).service('svc', ['$rootScope', 'producFactory', '$timeout', '$location', 'jwtHelper', 'authFactory', '$interval','svcpedidos', function($rootScope, producFactory, $timeout, $location, jwtHelper, authFactory, $interval,svcpedidos) {
    var svc = {};

    svc.getfirstcat = function() {
        var mincat = null,
            id;
        angular.forEach($rootScope.categoriasindex, function(cat) {
            if (mincat == null) {
                mincat = cat.DI;
                id = cat.id;
            } else if (mincat > cat.DI) {
                mincat = cat.DI;
                id = cat.id;
            }

        });
        return id;
    }

    svc.setproduct = function(categoria) {
        $rootScope.type = 0;
        angular.forEach($rootScope.categorias, function(cate) {
            cate.selec = false;
        });
        categoria.selec = true;
        $rootScope.productos = $rootScope.categoriasindex[categoria.id].product;
    }

    svc.getmesas = function() {
        var token = localStorage.getItem('token');
        producFactory.gmesas(token).then(function(res) {
            if (res.data && res.data.code == 0) {
				$rootScope.grupos=res.data.response.grupos;
				$rootScope.mesag=$rootScope.grupos[1].m;
				$rootScope.grupos[1].selec=true;
                $rootScope.mesas = {};
                angular.forEach(res.data.response.mesas, function(mesa, i) {
                    $rootScope.mesas[mesa.id] = {
                        'id': mesa.id,
                        'N': mesa.N,
						'G':mesa.G,
                        'M': '',
                        'color': 0,
                        'pid': ''
                    };
                });
                svc.updatemesas();
				$rootScope.upmesas
				 $interval.cancel($rootScope.upmesas);
						$rootScope.upmesas=$interval(function() {
	                 svc.updatemesas();
				
                }, 5000);
	          //console.log($rootScope.mesas);
            }
        });

    }

    svc.updatemesas = function() {
        $rootScope.mesastat = function() {
            var token = localStorage.getItem('token');
            producFactory.mesastat(token).then(function(res) {
                if (res.data && res.data.code == 0) {
                    var mesaupdate = res.data.response.mesas;
                    angular.forEach($rootScope.mesas, function(mesa, i) {
                        mesa.M = '';
                        mesa.color = 0;
                        mesa.T = '';
                        mesa.P = '';
                        mesa.active = false;
						mesa.pid = null;
                        if (mesaupdate[i] != null) {
                            mesa.M = mesaupdate[i].M;
                            mesa.T = mesaupdate[i].time;
                            mesa.pid = mesaupdate[i].oid;
                            mesa.P = mesaupdate[i].T;
                            mesa.GN = mesaupdate[i].GN;
                            mesa.active = true;
                            mesa.color = 1;
                        }
                    });

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
                            $rootScope.mesastat();
                        } else {
                            $rootScope.slogin = false;
                            $location.path("/login");
                        }
                    });
                }
            } else {
                $rootScope.slogin = true;
                $rootScope.mesastat();
            }
        }
    }


    svc.sendpedido = function() {
        var token = localStorage.getItem('token');

        if ($rootScope.currentmesa.pid)
            $rootScope.productlist.pid = $rootScope.currentmesa.pid;

        $rootScope.productlist.h = {
            'EmployeeID': $rootScope.meseroid,
            'nombre': $rootScope.mesero,
            'DineInTableID': $rootScope.currentmesa.id,
            'DineInTableText': $rootScope.currentmesa.N,
            'AmountDue': $rootScope.totalorden,
            'GuestNumber': $rootScope.currentmesa.GN
        };

        if ($rootScope.productlist.p.length>0 )
        {
			
		
            $rootScope.enviando = true;
            producFactory.pedido(token, JSON.stringify($rootScope.productlist)).then(function(res) {
                if (res.data && res.data.code == 0) {
					 angular.forEach($rootScope.categorias, function(cate) {
            cate.selec = false;
        });
					
                    $rootScope.enviado = true;
                    $rootScope.inprocess = true;
                    $rootScope.currentmesa.pid = res.data.pedid;
                    $timeout(function() {
                        $rootScope.enviando = false;
                        $rootScope.enviado = false;
                        $rootScope.titulo = $rootScope.mesero;
                        $rootScope.currentmesa = null;
                        $location.path("/mesas");
                    }, 800);

                } else if (res.data.response = 'errortoken') {
                    var refreshToken = localStorage.getItem('refresh_token');
                    if (refreshToken !== null) {
                        authFactory.delegation(refreshToken).then(function(res) {
                            if (res.data && res.data.code == 0) {
                                localStorage.setItem('token', res.data.response.token);
                                localStorage.setItem('refresh_token', res.data.response.refresh_token);
                                svc.sendpedido();

                            } else {
                                $rootScope.slogin = false;
                                $rootScope.mensaje = 'ERROR DE AUTENTICACION'
                                $timeout(function() {
                                    $location.path("/login");
                                }, 2000);

                            }
                        });
                    } else {
                        $rootScope.slogin = false;
                        $location.path("/login");
                    }
                }
            });
        } else {
            $rootScope.enviando = true;
			$rootScope.enviado = true;
            $rootScope.mensaje = 'Complete el Pedido';
            $rootScope.inprocess = false;
            $timeout(function() {
                $rootScope.enviado = false;
              	$rootScope.enviando = false;
                $rootScope.inprocess = false;
				  $rootScope.mensaje = 'Enviado';
            }, 1500);
        }

    }

    svc.getproduct = function(id) {
        var token = localStorage.getItem('token');

        producFactory.getproduct(token).then(function(res) {
            if (res.data && res.data.code == 0) {
                var P = [];
                angular.forEach(res.data.response.product, function(product, i) {

                    if (product.P == 0)
                        product.P = '-';
				    P[product.id] = product;
                    P[product.id].modifi = [];
                    P[product.id].subproduct = [];

                });

                angular.forEach(res.data.response.modifi, function(modifi, i) {
                    modifi.selec = false;
                    P[modifi.MID].modifi.push(modifi);
                });
				var index;
                angular.forEach(P, function(p, i) {

                    if (p.barcode == 'notas') {

                        $rootScope.notasmodi = p.modifi;
						index=i;
                    }



                    if (p.MIT == 1 && p.MIPHID != null) {
                        P[p.MIPHID].subproduct.push(p);
                    }
                });
				P.splice(index, 1);
                angular.forEach(P, function(p, i) {

                    if (p.MIPHID == null)
                        $rootScope.categoriasindex[p.M].product.push(p);
					$rootScope.productos = $rootScope.categoriasindex[$rootScope.firtcat].product;
                    $rootScope.productostemp = $rootScope.categoriasindex[$rootScope.firtcat].product;

                });
            }

        });

    }

    svc.getcategorias = function() {
        var token = localStorage.getItem('token');
        producFactory.getcategorias(token).then(function(res) {
            $rootScope.categoriasindex = [];
            if (res.data && res.data.code == 0) {
                $rootScope.categorias = res.data.response.categorias;
                var mincat = null,
                    id;
                angular.forEach(res.data.response.categorias, function(cate, i) {
                    $rootScope.categoriasindex[cate.id] = cate;
                    $rootScope.categoriasindex[cate.id].product = [];
                    if (mincat == null) {
                        mincat = cate.DI;
                        id = cate.id;
                    } else if (mincat > cate.DI) {
                        mincat = cate.DI;
                        id = cate.id;
                    }

                });
                $rootScope.firtcat = id;
                svc.getproduct();

            }

        });


    }
	
	
	return svc;
}])


.factory("producFactory", ["$http", "$q", 'store', "CONFIG", function($http, $q, store, CONFIG) {
    var produc = {};

    produc.gmesas = function(token) {
        var deferred;
        deferred = $q.defer();
        $http({
                method: 'POST',
                skipAuthorization: true,
                url: CONFIG.APIURL + '/home/mesas',
                data: "atoken=" + token,
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


    produc.mesastat = function(token) {
        var deferred;
        deferred = $q.defer();
        $http({
                method: 'POST',
                skipAuthorization: true,
                url: CONFIG.APIURL + '/home/mesastat',
                data: "atoken=" + token,
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
    produc.getproduct = function(token, id) {
        var deferred;
        deferred = $q.defer();
        $http({
                method: 'POST',
                skipAuthorization: true,
                url: CONFIG.APIURL + '/home/product',
                data: "atoken=" + token,
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



    produc.getcategorias = function(token) {
        var deferred;
        deferred = $q.defer();
        $http({
                method: 'POST',
                skipAuthorization: true,
                url: CONFIG.APIURL + '/home/categorias',
                data: "atoken=" + token,
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

    produc.pedido = function(token, pedido) {
        var deferred;
        deferred = $q.defer();
        $http({
                method: 'POST',
                skipAuthorization: true,
                url: CONFIG.APIURL + '/home/pedido',
                data: "atoken=" + token + "&list=" + pedido,
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


    return produc;
}]);