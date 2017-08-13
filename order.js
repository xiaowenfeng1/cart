
angular.module('ProductsApp', ['ui.router', 'LocalStorageModule', 'firebase'])
    .constant('firebaseUrl', 'https://coffee-orders.firebaseio.com')
    .constant('ordersKey', 'orders')

    .factory('contacts', function(localStorageService, storageKey) {
        return localStorageService.get(storageKey) || [];
    })
    .factory('productsJSON', function($http) {
        return $http.get('data/products.json')

    })
    .config(function($stateProvider, $urlRouterProvider) {
        $stateProvider
            .state('cart', {
                url:'/cart',
                templateUrl: 'views/shopping-cart.html',
                controller: 'ProductsController'
            })
            .state('checkout', {
                url:'/checkout',
                templateUrl:'views/checkout.html',
                controller:'CheckoutController'
            })
            .state('confirmation', {
                url:'/confirmation',
                templateUrl:'views/confirmation.html',
                controller: 'CheckoutController'
            });

        $urlRouterProvider.otherwise('/cart');
    })

    .directive('withinTenYears', function() {
        return {
            require: 'ngModel',
            link: function(scope, elem, attrs, controller) {
                controller.$validators.withinTenYears = function(modelValue) {
                    var today = new Date();
                    var currentYear = today.getFullYear();
                    return (modelValue <= (currentYear + 10 ) && modelValue >= currentYear);
                }
            }
        }
    })

    .directive('luhnCheck', function() {
        return {
            require: 'ngModel',
            link: function(scope, elem, attrs, controller) {
                controller.$validators.luhnCheck = function (cnumber) {
                    if (cnumber !== undefined && cnumber.length === 16) {
                        return luhnChk(cnumber);
                    } else {
                        return false;
                    }
                }
            }
        }
    })

    .directive('addressForm', function() {
        return {
            scope: {
                address: "="
            },
            restrict: 'E',
            transclude: true,
            templateUrl: 'views/address-form.html'
        };
    })

    .controller('ProductsController', function($scope, productsJSON, ordersKey) {
        'use strict';

        var errorMessage = $('#error-message');
        function clearError() {
            errorMessage.hide();
        }

        productsJSON.then(function (results) {
            clearError();
            $scope.products = results.data;

            $scope.grindType = ['Whole Bean','Espresso', 'French Press', 'Filter'];

            $scope.selectedGrd = $scope.grindType[0];
            $scope.categories = _.uniq(_.flatten(_.pluck($scope.products, 'categories')));

            $scope.filters = {};

            $scope.orders = angular.fromJson(localStorage.getItem(ordersKey)) || [];

            function saveOrders() {
                localStorage.setItem(ordersKey, angular.toJson($scope.orders));
            }

            // add an item into the shopping cart
            $scope.addToCart = function(name, grind, price, qty) {
                clearError();
                qty = _.parseInt(qty);

                //check if the quality is larger than 1, less than 10
                if ( _.inRange(qty, 1, 11) ) {

                    if (checkQty(name, qty)) {
                        qty = _.round(qty);
                        $scope.orders.push({
                            name: name,
                            grind: grind,
                            price: price,
                            qty: qty
                        });

                        saveOrders();
                        $scope.name = "";
                        $scope.grind = "";
                        $scope.price = "";
                        $scope.qty = "";

                    } else {
                        errorMessage.text("The total quality of a coffee must less than 10 pounds.");
                        errorMessage.fadeIn();
                    }
                }
                 else {
                    errorMessage.text("The quality must be between 1 and 10 pounds.");
                    errorMessage.fadeIn();
                }
            };

            // remove an item from the shopping cart
            $scope.removeFromCart = function(order) {
                var index = $scope.orders.indexOf(order);
                $scope.orders.splice(index, 1);

                saveOrders();
            };

            // check quality of a type of coffee before adding extra
            function checkQty(name, newQty) {
                var result = _.filter($scope.orders, function (n){
                    return n.name == name;
                    //console.log(result);
                });

                var totalQty = _.reduce(result, function (total, order) {
                    return (total + order.qty);

                }, 0);

                //console.log(newQty+totalQty);
                if (newQty + totalQty > 10) {
                    return false;
                } else {
                    return true;
                }
            }

            // calculate the total cost of all the items
            $scope.totalCost = function () {
                var total = 0;
                for (var newOrder = 0; newOrder < $scope.orders.length; newOrder++) {
                    total += Number($scope.orders[newOrder].price * $scope.orders[newOrder].qty);
                }
                return total;
            }
        });
    })

    .controller('CheckoutController', function($scope, $state, firebaseUrl, $firebaseArray, ordersKey) {
        var rootRef = new Firebase(firebaseUrl);
        $scope.checkout = $firebaseArray(rootRef);

        $scope.shipping = {};
        $scope.billing = {};
        $scope.card = {};

        // get the orders from local storage
        $scope.orders = angular.fromJson(localStorage.getItem(ordersKey)) || [];

        //calculate the grant total of the order
        $scope.totalCost = function () {
            var total = 0;
            for (var newOrder = 0; newOrder < $scope.orders.length; newOrder++) {
                total += Number($scope.orders[newOrder].price * $scope.orders[newOrder].qty);
            }
            return total;
        };

        //check whether the checkbox is checked
        $scope.isSameAsShipping = false;
        $scope.sameAsShippingClicked = function() {
            $scope.isSameAsShipping = !$scope.isSameAsShipping;
        };

        $scope.$watch('isSameAsShipping', function (isSame) {
            if(isSame) {
                $scope.billing = $scope.shipping;
            } else {
                //if the checkbox is unchecked, clear the billing address form
                $scope.billing = {};
            }
        });

        //save all the information to firebase
        $scope.save = function() {
            $scope.checkout.$add({
                shipping: $scope.shipping,
                billing: $scope.billing,
                card: $scope.card,
                orders: $scope.orders,
                totalCost: $scope.totalCost(),
                createdAt: Firebase.ServerValue.TIMESTAMP

            }).then(function() {
                //clear out the shopping cart
                $scope.orders =[];
                localStorage.setItem(ordersKey, angular.toJson($scope.orders));
                $state.go('confirmation');
            });
        }
    });
