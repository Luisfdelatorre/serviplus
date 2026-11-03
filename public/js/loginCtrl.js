app.controller('loginCtrl', ['$rootScope', '$scope', 'CONFIG', 'authFactory', 'svclogin',  '$location','$timeout',function($rootScope, $scope, CONFIG, authFactory, svclogin, $location,$timeout) {
$scope.login = {};
$scope.signup = {};
$rootScope.clave='';
$rootScope.getipval = false;
$rootScope.init=0;
$rootScope.categorias={};
$rootScope.categoriasindex={};
if ($rootScope.slogin) {
	$location.path("/mesas");
  }
$scope.clickkey = function(key){
	$rootScope.red = false;
	svclogin.clickkey(key,'login') 
}



   $rootScope.reload = function() {
		var serverip = localStorage.getItem('serverip');
		svclogin.getip(serverip);
	

	//localStorage.removeItem('token');
	//$location.path("login");
 }     
 $rootScope.setipval = function() {
	    $rootScope.testiptimer=true;
	    var cleanInput = ($scope.inputip || '').trim();
	    authFactory.ping(cleanInput,'setip').then(function(res) {
				   if (res.data && res.data.code == 0) {
					   var proto = (window.location && window.location.protocol === 'https:') ? 'https://' : 'http://';
					   var fullUrl = cleanInput.indexOf('://') > -1 ? cleanInput : proto + cleanInput;
					   fullUrl = fullUrl.replace(/\/+$/, '');
					   CONFIG.APIURL = fullUrl;
					   localStorage.setItem('serverip', fullUrl.replace(/^https?:\/\//, ''));
					   $rootScope.getipval = false;
					   $rootScope.submit = false;
					   $rootScope.excuterip=0;
					   $rootScope.testiptimer=false;
					   $rootScope.conectview = false;
					}
			  });
 }   
        

    }]).service('svclogin', ['$rootScope','authFactory','store', 'md5','svc','svcpedidos','$location','CONFIG', function($rootScope,authFactory,store,md5,svc,svcpedidos,$location,CONFIG) {
        var svclogin = {};

        svclogin.getip = function(ip) {
            var resolved = false;

            function onServerFound(targetHost) {
                if (resolved) return;
                resolved = true;

                var fullUrl = ('' + targetHost).trim();
                if (fullUrl.indexOf('://') === -1) {
                    var proto = (window.location && window.location.protocol === 'https:') ? 'https://' : 'http://';
                    fullUrl = proto + fullUrl;
                }
                fullUrl = fullUrl.replace(/\/+$/, '');
                var plainHost = fullUrl.replace(/^https?:\/\//, '');

                CONFIG.APIURL = fullUrl;
                localStorage.setItem('serverip', plainHost);
                $rootScope.ipready = true;
                $rootScope.conectview = false;
                $rootScope.getipval = false;
                $rootScope.submit = false;
                $rootScope.testiptimer = false;
                $rootScope.excuterip = 0;
                console.log('[ServiPlus AutoDiscovery] Servidor conectado con éxito en:', fullUrl);
            }

            // 1. Construir lista de candidatos prioritarios
            var candidates = [];

            // Si se ejecuta en navegador (http/https), el host actual es la prioridad #1
            if (window.location && window.location.protocol && window.location.protocol.indexOf('http') === 0) {
                if (window.location.host) {
                    candidates.push(window.location.host);
                }
                if (window.location.hostname && window.location.hostname !== window.location.host) {
                    candidates.push(window.location.hostname);
                    candidates.push(window.location.hostname + ':8088');
                }
            }

            // Host guardado o recibido
            var saved = ip || localStorage.getItem('serverip');
            if (saved && typeof saved === 'string') {
                var s = saved.trim();
                if (s) {
                    candidates.push(s);
                    if (s.indexOf(':') === -1) {
                        candidates.push(s + ':8088');
                    }
                }
            }

            // Servidores conocidos de la red local
            var defaults = [
                '192.168.1.150',
                '192.168.1.150:8088',
                '127.0.0.1',
                '127.0.0.1:8088',
                'localhost',
                'localhost:8088',
                '192.168.1.13',
                '192.168.1.100'
            ];
            for (var d = 0; d < defaults.length; d++) {
                candidates.push(defaults[d]);
            }

            // Eliminar duplicados manteniendo orden
            var queue = [];
            for (var i = 0; i < candidates.length; i++) {
                var c = candidates[i].trim();
                if (c && queue.indexOf(c) === -1) {
                    queue.push(c);
                }
            }

            // Sondeo rápido y ordenado
            function testCandidate(index) {
                if (resolved) return;
                if (index >= queue.length) {
                    sweepSubnet();
                    return;
                }

                var cand = queue[index];
                authFactory.ping(cand, 'quick').then(function(res) {
                    if (res && res.data && res.data.code === 0) {
                        onServerFound(cand);
                    } else {
                        testCandidate(index + 1);
                    }
                }, function() {
                    testCandidate(index + 1);
                });
            }

            // Barrido inteligente de subred si ningún candidato inicial respondió
            function sweepSubnet() {
                if (resolved) return;
                var base = CONFIG.APIURLBASE || '192.168.1.';
                if (window.location && window.location.hostname) {
                    var parts = window.location.hostname.split('.');
                    if (parts.length === 4) {
                        base = parts[0] + '.' + parts[1] + '.' + parts[2] + '.';
                    }
                }

                var scanList = [150, 100, 200, 2, 3, 4, 5, 10, 13, 20, 25, 30, 50, 101, 102, 151, 254];
                for (var s = 0; s < scanList.length; s++) {
                    (function(num) {
                        var ipTarget = base + num;
                        authFactory.ping(ipTarget, 'count').then(function(res) {
                            if (res && res.data && res.data.code === 0) {
                                onServerFound(ipTarget);
                            }
                        });
                    })(scanList[s]);
                }
            }

            testCandidate(0);
        };

	  svclogin.doLogin = function(key) {
            authFactory.login(key).then(function(res) {
           
                if (res.data && res.data.code == 0) {
                    var data=res.data.setup[0];
                    
                    localStorage.setItem('token', res.data.response.token);
                    localStorage.setItem('refresh_token', res.data.response.refresh_token);
                    localStorage.setItem('key', md5.createHash(key));
                    localStorage.setItem('nombre', data.N);
                    localStorage.setItem('id', data.id);
                    $rootScope.clave = '';
                    for (var j = 0; j < 4; j++) {
                        $rootScope.circle[j]='circle';
                    }
                    
                    $rootScope.mesero = data.N;
                    $rootScope.meseroid = data.id;
                    $rootScope.titulo = $rootScope.mesero;
                    if ($rootScope.titulo.length > 16) {
                        $rootScope.titulo = $rootScope.titulo.substr(0, 16) + '...';
                    }
                    $rootScope.meseroinput = $rootScope.mesero;
                    $rootScope.meseroidinput = $rootScope.meseroid;
                    $rootScope.init=1;
					$rootScope.submit=0;
					$rootScope.slogin = true;
					if (data.Vr==true)
					{
						$location.path("/visor");
						localStorage.setItem('visor', true);
						document.getElementById('audiotag1').play();
						var visor=localStorage.getItem('visor');
			
					 
					 svcpedidos.getordenes();
              
						
					}
					else
					{
						$location.path("/mesas");
						localStorage.setItem('visor', false);
						svc.getmesas();
                    	svc.getcategorias();
					}
					
					
                }else{
					
					 $rootScope.clave = '';
                    for (var j = 0; j < 4; j++) {
                        $rootScope.circle[j]='circle';
                    }
                    $rootScope.slogin = false;
					$rootScope.red = true;
			
				}
            });
        }
	
	  svclogin.clickkey = function(key,pantalla) {
            if (key.id<=10){
                if ($rootScope.clave.length <= 4) {
                    $rootScope.clave = $rootScope.clave + key.value;
                    $rootScope.circle[$rootScope.clave.length-1]='circle-full';
                }
            			
				if ($rootScope.clave.length == 4) {
					
                    var key= localStorage.getItem('key');
					if(pantalla!='login'){
                    if (key==md5.createHash($rootScope.clave)){
                        var nombre=localStorage.getItem('nombre');
                        $rootScope.mesero = nombre;
                        $rootScope.meseroid = localStorage.getItem('id');
                        $rootScope.titulo=$rootScope.mesero;
						$rootScope.submit=0;
						$rootScope.init=1;
						$rootScope.clave = '';
                    	for (var j = 0; j < 4; j++) {
                        	$rootScope.circle[j]='circle';
                    	}
						var visor=localStorage.getItem('visor');
				
						if(visor=='true'){
				   			$location.path("/visor");
							document.getElementById('audiotag1').play();
						}
                    }else{
						localStorage.removeItem('visor');
						localStorage.removeItem('token');
                        localStorage.removeItem('refresh_token');
                        localStorage.removeItem('key');
                        localStorage.removeItem('nombre');
                        localStorage.removeItem('id');
						$location.path("/login");
						 for (var j = 0; j < 4; j++) {
                        $rootScope.circle[j]='circle';
							 $rootScope.submit=0;
                    }
					}
						
				}else{
                        
                        
                        svclogin.doLogin($rootScope.clave);
                    }
                 
                  
                    
                 }
				
							
				
            }else if(key.id==11){
                $rootScope.clave = '';
                    for (var j = 0; j < 4; j++) {
                        $rootScope.circle[j]='circle';
                    }
            }else if(key.id==12){ 
                $rootScope.circle[$rootScope.clave.length-1]='circle';
            $rootScope.clave = $rootScope.clave.substring(0, $rootScope.clave.length - 1);
                
       
        }
            
            
        }
	  
	  
        return svclogin;
    }])





    .factory("authFactory", ["$http", "$q", 'store', "CONFIG", function($http, $q, store, CONFIG) {
        var authFactory = {};
        authFactory.login = function(key) {
            var deferred;
            deferred = $q.defer();
            $http({
                    method: 'POST',
                    skipAuthorization: true,
				    url: CONFIG.APIURL + '/auth/login',
                    data: "key=" + key ,
                    headers: {'Content-Type': 'application/x-www-form-urlencoded'}
                })
                .then(function(res) {
                    deferred.resolve(res);
                })
                .then(function(error) {
                    deferred.reject(error);
                })
            return deferred.promise;
        };
		 authFactory.ping = function(key,t) {
            var deferred = $q.defer();
            var target = key ? ('' + key).trim() : '';
            var url;
            if (!target) {
                url = '/ping';
            } else if (target.indexOf('://') > -1) {
                url = target.replace(/\/+$/, '') + '/ping';
            } else {
                var protocol = (window.location && window.location.protocol === 'https:') ? 'https://' : 'http://';
                url = protocol + target.replace(/\/+$/, '') + '/ping';
            }

            $http({
                    method: 'POST',
                    skipAuthorization: true,
				    url: url,
					data: 'key=' + encodeURIComponent(target) + '&' + (t || 'discovery'),
					timeout : 600,
                    headers: {'Content-Type': 'application/x-www-form-urlencoded'}
                })
                .then(function(res) {
                    deferred.resolve(res);
                }, function(error) {
			        deferred.reject(error);
                });
            return deferred.promise;
        };
      
       

    authFactory.delegation = function(token) {

            var deferred;
            deferred = $q.defer();
            $http({
                    method: 'POST',
                    skipAuthorization: true,
                    url: CONFIG.APIURL + '/auth/delegation',
                    data: "refresh_token=" + token,
                    headers: {'Content-Type': 'application/x-www-form-urlencoded'}
                })
                .then(function(res) {
                    deferred.resolve(res);
                })
                .then(function(error) {
                    deferred.reject(error);
                })
            return deferred.promise;
        };

        return authFactory;
    }]).factory('md5', [function() {

  var md5 = {

   createHash: function(str) {
     
    if (null === str) {
     return null;   
    }
    
    var xl;

    var rotateLeft = function (lValue, iShiftBits) {
     return (lValue << iShiftBits) | (lValue >>> (32 - iShiftBits));
    };

    var addUnsigned = function (lX, lY) {
     var lX4, lY4, lX8, lY8, lResult;
     lX8 = (lX & 0x80000000);
     lY8 = (lY & 0x80000000);
     lX4 = (lX & 0x40000000);
     lY4 = (lY & 0x40000000);
     lResult = (lX & 0x3FFFFFFF) + (lY & 0x3FFFFFFF);
     if (lX4 & lY4) {
      return (lResult ^ 0x80000000 ^ lX8 ^ lY8);
     }
     if (lX4 | lY4) {
      if (lResult & 0x40000000) {
       return (lResult ^ 0xC0000000 ^ lX8 ^ lY8);
      } else {
       return (lResult ^ 0x40000000 ^ lX8 ^ lY8);
      }
     } else {
      return (lResult ^ lX8 ^ lY8);
     }
    };

    var _F = function (x, y, z) {
     return (x & y) | ((~x) & z);
    };
    var _G = function (x, y, z) {
     return (x & z) | (y & (~z));
    };
    var _H = function (x, y, z) {
     return (x ^ y ^ z);
    };
    var _I = function (x, y, z) {
     return (y ^ (x | (~z)));
    };

    var _FF = function (a, b, c, d, x, s, ac) {
     a = addUnsigned(a, addUnsigned(addUnsigned(_F(b, c, d), x), ac));
     return addUnsigned(rotateLeft(a, s), b);
    };

    var _GG = function (a, b, c, d, x, s, ac) {
     a = addUnsigned(a, addUnsigned(addUnsigned(_G(b, c, d), x), ac));
     return addUnsigned(rotateLeft(a, s), b);
    };

    var _HH = function (a, b, c, d, x, s, ac) {
     a = addUnsigned(a, addUnsigned(addUnsigned(_H(b, c, d), x), ac));
     return addUnsigned(rotateLeft(a, s), b);
    };

    var _II = function (a, b, c, d, x, s, ac) {
     a = addUnsigned(a, addUnsigned(addUnsigned(_I(b, c, d), x), ac));
     return addUnsigned(rotateLeft(a, s), b);
    };

    var convertToWordArray = function (str) {
     var lWordCount;
     var lMessageLength = str.length;
     var lNumberOfWords_temp1 = lMessageLength + 8;
     var lNumberOfWords_temp2 = (lNumberOfWords_temp1 - (lNumberOfWords_temp1 % 64)) / 64;
     var lNumberOfWords = (lNumberOfWords_temp2 + 1) * 16;
     var lWordArray = new Array(lNumberOfWords - 1);
     var lBytePosition = 0;
     var lByteCount = 0;
     while (lByteCount < lMessageLength) {
      lWordCount = (lByteCount - (lByteCount % 4)) / 4;
      lBytePosition = (lByteCount % 4) * 8;
      lWordArray[lWordCount] = (lWordArray[lWordCount] | (str.charCodeAt(lByteCount) << lBytePosition));
      lByteCount++;
     }
     lWordCount = (lByteCount - (lByteCount % 4)) / 4;
     lBytePosition = (lByteCount % 4) * 8;
     lWordArray[lWordCount] = lWordArray[lWordCount] | (0x80 << lBytePosition);
     lWordArray[lNumberOfWords - 2] = lMessageLength << 3;
     lWordArray[lNumberOfWords - 1] = lMessageLength >>> 29;
     return lWordArray;
    };

    var wordToHex = function (lValue) {
     var wordToHexValue = '',
      wordToHexValue_temp = '',
      lByte, lCount;
     for (lCount = 0; lCount <= 3; lCount++) {
      lByte = (lValue >>> (lCount * 8)) & 255;
      wordToHexValue_temp = '0' + lByte.toString(16);
      wordToHexValue = wordToHexValue + wordToHexValue_temp.substr(wordToHexValue_temp.length - 2, 2);
     }
     return wordToHexValue;
    };

    var x = [],
     k, AA, BB, CC, DD, a, b, c, d, S11 = 7,
     S12 = 12,
     S13 = 17,
     S14 = 22,
     S21 = 5,
     S22 = 9,
     S23 = 14,
     S24 = 20,
     S31 = 4,
     S32 = 11,
     S33 = 16,
     S34 = 23,
     S41 = 6,
     S42 = 10,
     S43 = 15,
     S44 = 21;

    //str = this.utf8_encode(str);
    x = convertToWordArray(str);
    a = 0x67452301;
    b = 0xEFCDAB89;
    c = 0x98BADCFE;
    d = 0x10325476;

    xl = x.length;
    for (k = 0; k < xl; k += 16) {
     AA = a;
     BB = b;
     CC = c;
     DD = d;
     a = _FF(a, b, c, d, x[k + 0], S11, 0xD76AA478);
     d = _FF(d, a, b, c, x[k + 1], S12, 0xE8C7B756);
     c = _FF(c, d, a, b, x[k + 2], S13, 0x242070DB);
     b = _FF(b, c, d, a, x[k + 3], S14, 0xC1BDCEEE);
     a = _FF(a, b, c, d, x[k + 4], S11, 0xF57C0FAF);
     d = _FF(d, a, b, c, x[k + 5], S12, 0x4787C62A);
     c = _FF(c, d, a, b, x[k + 6], S13, 0xA8304613);
     b = _FF(b, c, d, a, x[k + 7], S14, 0xFD469501);
     a = _FF(a, b, c, d, x[k + 8], S11, 0x698098D8);
     d = _FF(d, a, b, c, x[k + 9], S12, 0x8B44F7AF);
     c = _FF(c, d, a, b, x[k + 10], S13, 0xFFFF5BB1);
     b = _FF(b, c, d, a, x[k + 11], S14, 0x895CD7BE);
     a = _FF(a, b, c, d, x[k + 12], S11, 0x6B901122);
     d = _FF(d, a, b, c, x[k + 13], S12, 0xFD987193);
     c = _FF(c, d, a, b, x[k + 14], S13, 0xA679438E);
     b = _FF(b, c, d, a, x[k + 15], S14, 0x49B40821);
     a = _GG(a, b, c, d, x[k + 1], S21, 0xF61E2562);
     d = _GG(d, a, b, c, x[k + 6], S22, 0xC040B340);
     c = _GG(c, d, a, b, x[k + 11], S23, 0x265E5A51);
     b = _GG(b, c, d, a, x[k + 0], S24, 0xE9B6C7AA);
     a = _GG(a, b, c, d, x[k + 5], S21, 0xD62F105D);
     d = _GG(d, a, b, c, x[k + 10], S22, 0x2441453);
     c = _GG(c, d, a, b, x[k + 15], S23, 0xD8A1E681);
     b = _GG(b, c, d, a, x[k + 4], S24, 0xE7D3FBC8);
     a = _GG(a, b, c, d, x[k + 9], S21, 0x21E1CDE6);
     d = _GG(d, a, b, c, x[k + 14], S22, 0xC33707D6);
     c = _GG(c, d, a, b, x[k + 3], S23, 0xF4D50D87);
     b = _GG(b, c, d, a, x[k + 8], S24, 0x455A14ED);
     a = _GG(a, b, c, d, x[k + 13], S21, 0xA9E3E905);
     d = _GG(d, a, b, c, x[k + 2], S22, 0xFCEFA3F8);
     c = _GG(c, d, a, b, x[k + 7], S23, 0x676F02D9);
     b = _GG(b, c, d, a, x[k + 12], S24, 0x8D2A4C8A);
     a = _HH(a, b, c, d, x[k + 5], S31, 0xFFFA3942);
     d = _HH(d, a, b, c, x[k + 8], S32, 0x8771F681);
     c = _HH(c, d, a, b, x[k + 11], S33, 0x6D9D6122);
     b = _HH(b, c, d, a, x[k + 14], S34, 0xFDE5380C);
     a = _HH(a, b, c, d, x[k + 1], S31, 0xA4BEEA44);
     d = _HH(d, a, b, c, x[k + 4], S32, 0x4BDECFA9);
     c = _HH(c, d, a, b, x[k + 7], S33, 0xF6BB4B60);
     b = _HH(b, c, d, a, x[k + 10], S34, 0xBEBFBC70);
     a = _HH(a, b, c, d, x[k + 13], S31, 0x289B7EC6);
     d = _HH(d, a, b, c, x[k + 0], S32, 0xEAA127FA);
     c = _HH(c, d, a, b, x[k + 3], S33, 0xD4EF3085);
     b = _HH(b, c, d, a, x[k + 6], S34, 0x4881D05);
     a = _HH(a, b, c, d, x[k + 9], S31, 0xD9D4D039);
     d = _HH(d, a, b, c, x[k + 12], S32, 0xE6DB99E5);
     c = _HH(c, d, a, b, x[k + 15], S33, 0x1FA27CF8);
     b = _HH(b, c, d, a, x[k + 2], S34, 0xC4AC5665);
     a = _II(a, b, c, d, x[k + 0], S41, 0xF4292244);
     d = _II(d, a, b, c, x[k + 7], S42, 0x432AFF97);
     c = _II(c, d, a, b, x[k + 14], S43, 0xAB9423A7);
     b = _II(b, c, d, a, x[k + 5], S44, 0xFC93A039);
     a = _II(a, b, c, d, x[k + 12], S41, 0x655B59C3);
     d = _II(d, a, b, c, x[k + 3], S42, 0x8F0CCC92);
     c = _II(c, d, a, b, x[k + 10], S43, 0xFFEFF47D);
     b = _II(b, c, d, a, x[k + 1], S44, 0x85845DD1);
     a = _II(a, b, c, d, x[k + 8], S41, 0x6FA87E4F);
     d = _II(d, a, b, c, x[k + 15], S42, 0xFE2CE6E0);
     c = _II(c, d, a, b, x[k + 6], S43, 0xA3014314);
     b = _II(b, c, d, a, x[k + 13], S44, 0x4E0811A1);
     a = _II(a, b, c, d, x[k + 4], S41, 0xF7537E82);
     d = _II(d, a, b, c, x[k + 11], S42, 0xBD3AF235);
     c = _II(c, d, a, b, x[k + 2], S43, 0x2AD7D2BB);
     b = _II(b, c, d, a, x[k + 9], S44, 0xEB86D391);
     a = addUnsigned(a, AA);
     b = addUnsigned(b, BB);
     c = addUnsigned(c, CC);
     d = addUnsigned(d, DD);
    }

    var temp = wordToHex(a) + wordToHex(b) + wordToHex(c) + wordToHex(d);

    return temp.toLowerCase();
   }

  };

  return md5;

}]);